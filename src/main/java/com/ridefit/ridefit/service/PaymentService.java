package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.EngineOilType;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Payment;
import com.ridefit.ridefit.domain.PaymentOrderType;
import com.ridefit.ridefit.domain.PaymentStatus;
import com.ridefit.ridefit.domain.PurchaseOrder;
import com.ridefit.ridefit.domain.PurchaseOrderItem;
import com.ridefit.ridefit.domain.Reservation;
import com.ridefit.ridefit.domain.ReservationItem;
import com.ridefit.ridefit.dto.PaymentDtos.CheckoutResponse;
import com.ridefit.ridefit.dto.PaymentDtos.PartOrderItemRequest;
import com.ridefit.ridefit.dto.PaymentDtos.PartQuoteResponse;
import com.ridefit.ridefit.dto.PaymentDtos.PaymentItemView;
import com.ridefit.ridefit.dto.PaymentDtos.PaymentView;
import com.ridefit.ridefit.dto.PaymentDtos.ReservationView;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PaymentRepository;
import com.ridefit.ridefit.repository.PurchaseOrderRepository;
import com.ridefit.ridefit.repository.ReservationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

// Toss Payments 테스트 결제 흐름(부품/오일 구매, 정비·세차 예약 결제).
//  1) checkout: 서버가 DB 가격으로 금액을 확정 -> 주문/예약에 연결된 Payment(READY) 생성 -> orderId/금액을 프론트에 준다.
//  2) 프론트가 Toss 결제창을 띄우고, 성공하면 paymentKey/orderId/amount를 confirm으로 보낸다.
//  3) confirm: 본인 결제인지, READY인지, 보낸 금액 = 저장 금액 = 지금 DB 가격으로 다시 계산한 금액인지 확인한 뒤에만 Toss 승인 API를 부른다.
//     승인되면 PAID + 주문 PAID / 예약 CONFIRMED. 금액이 다르거나 Toss가 거절하면 FAILED(주문/예약은 확정되지 않음).
//  4) 승인은 됐는데 서버 저장이 실패하면 Toss 취소 API로 되돌린다(돈만 빠져나가고 기록이 없는 상태를 막는다).
// 프론트가 보낸 금액/가격은 어떤 경우에도 그대로 믿지 않는다. 로그에 시크릿 키/전체 paymentKey를 남기지 않는다.
@Slf4j
@Service
public class PaymentService {

    static final int MAX_ITEMS = 10;
    static final int MAX_QUANTITY = 10;
    // 이 카테고리 품목만으로 된 주문은 OIL(오일/소모품) 주문으로 분류한다. 지금 DB에는 해당 카테고리 부품이 없다.
    static final Set<String> OIL_CATEGORIES = Set.of("엔진오일", "오일", "오일필터", "소모품");

    private final PaymentRepository paymentRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PartRepository partRepository;
    private final ReservationRepository reservationRepository;
    private final MemberRepository memberRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final ReservationPricing reservationPricing;
    private final TossPaymentsClient tossPaymentsClient;
    private final TransactionTemplate tx;

    // 같은 주문번호의 승인 요청이 동시에 두 번 들어오면(새로고침/더블클릭) 두 번째는 Toss까지 가지 않고 막는다.
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();

    public PaymentService(PaymentRepository paymentRepository, PurchaseOrderRepository purchaseOrderRepository,
                          PartRepository partRepository, ReservationRepository reservationRepository,
                          MemberRepository memberRepository, MyVehicleRepository myVehicleRepository,
                          ReservationPricing reservationPricing, TossPaymentsClient tossPaymentsClient,
                          PlatformTransactionManager transactionManager) {
        this.paymentRepository = paymentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.partRepository = partRepository;
        this.reservationRepository = reservationRepository;
        this.memberRepository = memberRepository;
        this.myVehicleRepository = myVehicleRepository;
        this.reservationPricing = reservationPricing;
        this.tossPaymentsClient = tossPaymentsClient;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ---------------------------------------------------------------- 주문 미리보기 / 결제 준비

    @Transactional(readOnly = true)
    public PartQuoteResponse quotePart(Long partId, int quantity) {
        Part part = requireSellablePart(partId);
        int qty = requireQuantity(quantity);
        return new PartQuoteResponse(part.getId(), part.getName(), part.getCategory(), part.getImageUrl(), part.getPrice(),
                qty, Math.multiplyExact(part.getPrice(), qty), orderTypeOf(List.of(part.getCategory())).name());
    }

    @Transactional
    public CheckoutResponse checkoutParts(Long memberId, List<PartOrderItemRequest> items, Long myVehicleId) {
        requireConfigured();
        if (items == null || items.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "구매할 부품을 선택해주세요.");
        if (items.size() > MAX_ITEMS) throw new ApiException(HttpStatus.BAD_REQUEST, "한 번에 " + MAX_ITEMS + "개 품목까지 주문할 수 있어요.");

        MyVehicle vehicle = null;
        if (myVehicleId != null) {
            vehicle = myVehicleRepository.findById(myVehicleId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
            if (!vehicle.getMember().getId().equals(memberId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 선택할 수 있습니다.");
            }
        }

        // 같은 부품이 두 번 오면 수량을 합친다(순서 유지).
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (PartOrderItemRequest item : items) {
            quantities.merge(item.partId(), requireQuantity(item.quantity()), Integer::sum);
        }
        PurchaseOrder order = PurchaseOrder.builder()
                .member(memberRepository.getReferenceById(memberId))
                .myVehicle(vehicle)
                .status(PurchaseOrder.STATUS_PENDING_PAYMENT)
                .createdAt(LocalDateTime.now())
                .build();
        int total = 0;
        List<String> categories = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : quantities.entrySet()) {
            Part part = requireSellablePart(e.getKey());
            int qty = requireQuantity(e.getValue());
            int line = Math.multiplyExact(part.getPrice(), qty);
            total = Math.addExact(total, line);
            categories.add(part.getCategory());
            order.getItems().add(PurchaseOrderItem.builder()
                    .order(order).part(part).partName(part.getName()).category(part.getCategory())
                    .unitPrice(part.getPrice()).quantity(qty).lineAmount(line).build());
        }
        order.setTotalAmount(total);
        purchaseOrderRepository.save(order);

        List<PurchaseOrderItem> lines = order.getItems();
        String orderName = lines.get(0).getPartName() + (lines.size() > 1 ? " 외 " + (lines.size() - 1) + "건" : "");
        LocalDateTime now = LocalDateTime.now();
        Payment payment = paymentRepository.save(Payment.builder()
                .member(order.getMember())
                .orderId(newOrderId("P"))
                .orderType(orderTypeOf(categories))
                .purchaseOrder(order)
                .orderName(truncate(orderName, 100))
                .amount(total)
                .status(PaymentStatus.READY)
                .createdAt(now)
                .updatedAt(now)
                .build());
        log.info("결제 준비(부품): orderId={}, memberId={}, amount={}, items={}", payment.getOrderId(), memberId, total, quantities);
        return new CheckoutResponse(payment.getOrderId(), payment.getOrderName(), total, payment.getOrderType().name());
    }

    @Transactional
    public CheckoutResponse checkoutReservation(Long memberId, Long reservationId) {
        requireConfigured();
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "예약 정보를 찾을 수 없습니다."));
        if (!reservation.getMember().getId().equals(memberId)) {
            log.warn("다른 회원의 예약 결제 시도 차단: reservationId={}, memberId={}", reservationId, memberId);
            throw new ApiException(HttpStatus.FORBIDDEN, "본인의 예약만 결제할 수 있습니다.");
        }
        if (Reservation.STATUS_CONFIRMED.equals(reservation.getStatus())
                || !paymentRepository.findByReservationIdAndStatus(reservationId, PaymentStatus.PAID).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "이미 결제가 완료된 예약이에요.");
        }
        if (!Reservation.STATUS_REQUESTED.equals(reservation.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "취소된 예약은 결제할 수 없어요.");
        }
        int amount = reservationAmount(reservation);

        // 이 예약으로 결제창만 열고 끝낸 이전 시도(READY)는 정리하고 새 주문번호로 진행한다(동시에 유효한 결제 준비는 1건).
        LocalDateTime now = LocalDateTime.now();
        for (Payment old : paymentRepository.findByReservationIdAndStatus(reservationId, PaymentStatus.READY)) {
            old.setStatus(PaymentStatus.CANCELED);
            old.setFailureCode("REPLACED");
            old.setFailureMessage("새 결제 시도로 대체됨");
            old.setUpdatedAt(now);
        }
        List<String> services = reservation.getItems().stream().map(ReservationItem::getServiceName).toList();
        String orderName = reservation.getShop().getName() + " 예약 · " + services.get(0)
                + (services.size() > 1 ? " 외 " + (services.size() - 1) + "건" : "");
        Payment payment = paymentRepository.save(Payment.builder()
                .member(reservation.getMember())
                .orderId(newOrderId("R"))
                .orderType(PaymentOrderType.RESERVATION)
                .reservation(reservation)
                .orderName(truncate(orderName, 100))
                .amount(amount)
                .status(PaymentStatus.READY)
                .createdAt(now)
                .updatedAt(now)
                .build());
        log.info("결제 준비(예약): orderId={}, memberId={}, reservationId={}, amount={}", payment.getOrderId(), memberId, reservationId, amount);
        return new CheckoutResponse(payment.getOrderId(), payment.getOrderName(), amount, payment.getOrderType().name());
    }

    // ---------------------------------------------------------------- 승인

    public PaymentView confirm(Long memberId, String paymentKey, String orderId, int requestedAmount) {
        if (!inFlight.add(orderId)) {
            throw new ApiException(HttpStatus.CONFLICT, "결제 승인을 처리하고 있어요. 잠시 후 결제 내역에서 확인해주세요.");
        }
        try {
            // 1) 검증(트랜잭션 1): 본인/상태/금액. 금액이 맞지 않으면 FAILED로 남기고 Toss에는 요청하지 않는다.
            //    반환값: null = 이미 같은 paymentKey로 승인된 결제(새로고침), -1 = 금액 불일치, 그 외 = 승인 요청할 금액.
            Integer amount = tx.execute(status -> {
                Payment p = requireOwnPayment(memberId, orderId);
                if (p.getStatus() == PaymentStatus.PAID) {
                    if (paymentKey.equals(p.getPaymentKey())) return null;
                    throw new ApiException(HttpStatus.CONFLICT, "이미 결제가 완료된 주문이에요.");
                }
                if (p.getStatus() != PaymentStatus.READY) {
                    throw new ApiException(HttpStatus.CONFLICT, "이미 끝난 결제 요청이에요. 다시 결제를 시작해주세요.");
                }
                if (paymentRepository.existsByPaymentKey(paymentKey)) {
                    throw new ApiException(HttpStatus.CONFLICT, "이미 사용된 결제 정보예요.");
                }
                int serverAmount = currentAmount(p);
                if (requestedAmount != p.getAmount() || serverAmount != p.getAmount()) {
                    markFailed(p, "AMOUNT_MISMATCH", "결제 금액이 주문 금액과 달라 결제를 진행하지 않았어요.");
                    log.warn("결제 승인 거절(금액 불일치): orderId={}, memberId={}, requested={}, saved={}, current={}",
                            orderId, memberId, requestedAmount, p.getAmount(), serverAmount);
                    return -1;
                }
                return p.getAmount();
            });
            if (amount == null) {
                return detail(memberId, orderId);
            }
            if (amount < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "결제 금액이 주문 금액과 달라 결제를 진행하지 않았어요. 다시 시도해주세요.");
            }

            // 2) Toss 승인(트랜잭션 밖 - 외부 호출 동안 DB 연결을 잡고 있지 않는다).
            TossPaymentsClient.ConfirmResult result;
            try {
                result = tossPaymentsClient.confirm(paymentKey, orderId, amount);
            } catch (TossPaymentsClient.TossApiException e) {
                log.warn("Toss 승인 실패: orderId={}, paymentKey={}, httpStatus={}, code={}, message={}",
                        orderId, mask(paymentKey), e.httpStatus(), e.code(), e.getMessage());
                tx.executeWithoutResult(s -> markFailed(requireOwnPayment(memberId, orderId), e.code(), userMessageFor(e)));
                throw new ApiException(e.httpStatus() >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST, userMessageFor(e));
            }
            // (Integer끼리 !=는 객체 비교라 값으로 비교한다)
            if (result.totalAmount() == null || result.totalAmount().intValue() != amount.intValue() || !orderId.equals(result.orderId())) {
                // 결제사 응답이 우리 주문과 다르면 확정하지 않고 되돌린다.
                log.error("Toss 승인 응답 불일치: orderId={}, respOrderId={}, amount={}, respAmount={}",
                        orderId, result.orderId(), amount, result.totalAmount());
                safeCancel(paymentKey, "승인 응답 금액/주문번호 불일치");
                tx.executeWithoutResult(s -> markFailed(requireOwnPayment(memberId, orderId), "RESPONSE_MISMATCH",
                        "결제 확인 중 문제가 있어 결제를 취소했어요."));
                throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 확인 중 문제가 있어 결제를 취소했어요.");
            }

            // 3) 저장(트랜잭션 2). 실패하면 Toss 결제를 취소한다.
            try {
                tx.executeWithoutResult(s -> {
                    Payment p = requireOwnPayment(memberId, orderId);
                    LocalDateTime paidAt = result.approvedAt() == null ? LocalDateTime.now()
                            : result.approvedAt().atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    p.setStatus(PaymentStatus.PAID);
                    p.setPaymentKey(paymentKey);
                    p.setMethod(result.method());
                    p.setPaidAt(paidAt);
                    p.setFailureCode(null);
                    p.setFailureMessage(null);
                    p.setUpdatedAt(LocalDateTime.now());
                    if (p.getPurchaseOrder() != null) {
                        p.getPurchaseOrder().setStatus(PurchaseOrder.STATUS_PAID);
                        p.getPurchaseOrder().setPaidAt(paidAt);
                    }
                    if (p.getReservation() != null) {
                        p.getReservation().setStatus(Reservation.STATUS_CONFIRMED);
                    }
                    paymentRepository.saveAndFlush(p);
                });
            } catch (RuntimeException e) {
                log.error("결제 승인 후 저장 실패 - Toss 결제 취소 시도: orderId={}, paymentKey={}", orderId, mask(paymentKey), e);
                safeCancel(paymentKey, "서버 저장 실패로 자동 취소");
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "결제 승인 후 저장에 실패해 결제를 자동으로 취소했어요. 잠시 후 다시 시도해주세요.");
            }
            log.info("결제 승인 완료: orderId={}, memberId={}, amount={}, method={}", orderId, memberId, amount, result.method());
            return detail(memberId, orderId);
        } finally {
            inFlight.remove(orderId);
        }
    }

    // 결제창에서 실패/취소로 돌아온 경우. READY일 때만 바꾼다(이미 승인된 결제를 실패로 덮어쓰지 않는다).
    @Transactional
    public PaymentView fail(Long memberId, String orderId, String code, String message) {
        Payment p = requireOwnPayment(memberId, orderId);
        if (p.getStatus() == PaymentStatus.READY) {
            boolean userCanceled = "PAY_PROCESS_CANCELED".equals(code) || "USER_CANCEL".equals(code);
            p.setStatus(userCanceled ? PaymentStatus.CANCELED : PaymentStatus.FAILED);
            p.setFailureCode(truncate(code == null || code.isBlank() ? "UNKNOWN" : code, 100));
            p.setFailureMessage(truncate(userCanceled ? "결제를 취소했어요." : (message == null || message.isBlank() ? "결제에 실패했어요." : message), 500));
            p.setUpdatedAt(LocalDateTime.now());
            if (p.getPurchaseOrder() != null) p.getPurchaseOrder().setStatus(PurchaseOrder.STATUS_PAYMENT_FAILED);
            log.info("결제 실패/취소 기록: orderId={}, memberId={}, code={}", orderId, memberId, code);
        }
        return toView(p);
    }

    // ---------------------------------------------------------------- 조회

    @Transactional(readOnly = true)
    public List<PaymentView> myPayments(Long memberId) {
        return paymentRepository.findByMemberIdOrderByCreatedAtDescIdDesc(memberId).stream()
                // 결제창을 띄우기 직전 단계(READY)와 다른 시도로 대체된 건은 "내 결제"에서 뺀다.
                .filter(p -> p.getStatus() != PaymentStatus.READY && !"REPLACED".equals(p.getFailureCode()))
                .map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public PaymentView detail(Long memberId, String orderId) {
        return toView(requireOwnPayment(memberId, orderId));
    }

    // ---------------------------------------------------------------- 내부

    private Payment requireOwnPayment(Long memberId, String orderId) {
        Payment p = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "주문 정보를 찾을 수 없어요."));
        if (!p.getMember().getId().equals(memberId)) {
            log.warn("다른 회원의 결제 접근 차단: orderId={}, memberId={}", orderId, memberId);
            throw new ApiException(HttpStatus.FORBIDDEN, "본인의 주문만 확인할 수 있어요.");
        }
        return p;
    }

    // 승인 직전에 지금 DB 가격으로 다시 계산한 금액(결제 준비 이후 가격이 바뀌었으면 저장 금액과 달라진다).
    private int currentAmount(Payment p) {
        if (p.getPurchaseOrder() != null) {
            int total = 0;
            for (PurchaseOrderItem item : p.getPurchaseOrder().getItems()) {
                Part part = requireSellablePart(item.getPart().getId());
                total = Math.addExact(total, Math.multiplyExact(part.getPrice(), item.getQuantity()));
            }
            return total;
        }
        if (p.getReservation() != null) {
            return reservationAmount(p.getReservation());
        }
        throw new ApiException(HttpStatus.CONFLICT, "결제 대상이 없는 주문이에요.");
    }

    private int reservationAmount(Reservation reservation) {
        if (reservation.getItems().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "서비스 정보가 없는 예전 예약은 결제할 수 없어요. 새로 예약해주세요.");
        }
        int total = 0;
        for (ReservationItem item : reservation.getItems()) {
            EngineOilType oil = item.getOilType();
            Integer price = reservationPricing.price(reservation.getShop().getId(), item.getServiceName(), oil).price();
            if (price == null) {
                throw new ApiException(HttpStatus.CONFLICT, "가격이 정해지지 않은 서비스가 있어 결제할 수 없어요: " + item.getServiceName());
            }
            total = Math.addExact(total, price);
        }
        if (reservation.getTotalPrice() == null || reservation.getTotalPrice() != total) {
            throw new ApiException(HttpStatus.CONFLICT, "예약 이후 서비스 가격이 바뀌었어요. 새로 예약해주세요.");
        }
        return total;
    }

    private Part requireSellablePart(Long partId) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다."));
        if (part.getPrice() == null || part.getPrice() <= 0) {
            throw new ApiException(HttpStatus.CONFLICT, "판매 가격이 정해지지 않은 부품이에요: " + part.getName());
        }
        return part;
    }

    private static int requireQuantity(Integer quantity) {
        if (quantity == null || quantity < 1 || quantity > MAX_QUANTITY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "수량은 1~" + MAX_QUANTITY + "개로 선택해주세요.");
        }
        return quantity;
    }

    private void requireConfigured() {
        if (!tossPaymentsClient.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "결제 설정이 아직 되지 않았어요.");
        }
        if (!tossPaymentsClient.isTestKey()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "테스트 결제 환경에서만 결제할 수 있어요.");
        }
    }

    static PaymentOrderType orderTypeOf(List<String> categories) {
        return !categories.isEmpty() && categories.stream().allMatch(OIL_CATEGORIES::contains)
                ? PaymentOrderType.OIL : PaymentOrderType.PART;
    }

    private void markFailed(Payment p, String code, String message) {
        p.setStatus(PaymentStatus.FAILED);
        p.setFailureCode(truncate(code, 100));
        p.setFailureMessage(truncate(message, 500));
        p.setUpdatedAt(LocalDateTime.now());
        if (p.getPurchaseOrder() != null) p.getPurchaseOrder().setStatus(PurchaseOrder.STATUS_PAYMENT_FAILED);
    }

    private void safeCancel(String paymentKey, String reason) {
        try {
            tossPaymentsClient.cancel(paymentKey, reason);
            log.warn("Toss 결제 취소 완료: paymentKey={}, reason={}", mask(paymentKey), reason);
        } catch (RuntimeException e) {
            log.error("Toss 결제 취소 실패 - 수동 확인 필요: paymentKey={}, reason={}", mask(paymentKey), reason, e);
        }
    }

    // 사용자에게 보여줄 문구. Toss 메시지가 있으면 그대로(이미 한국어), 없으면 일반 문구.
    private static String userMessageFor(TossPaymentsClient.TossApiException e) {
        return switch (e.code()) {
            case "NETWORK_ERROR" -> "결제사와 통신하지 못했어요. 잠시 후 다시 시도해주세요.";
            case "NOT_CONFIGURED", "LIVE_KEY_BLOCKED" -> e.getMessage();
            case "ALREADY_PROCESSED_PAYMENT" -> "이미 처리된 결제예요.";
            default -> e.getMessage() == null || e.getMessage().isBlank() ? "결제 승인에 실패했어요." : e.getMessage();
        };
    }

    private PaymentView toView(Payment p) {
        List<PaymentItemView> items = p.getPurchaseOrder() == null ? List.of()
                : p.getPurchaseOrder().getItems().stream()
                .sorted(Comparator.comparing(PurchaseOrderItem::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(i -> new PaymentItemView(i.getPartName(), i.getCategory(), i.getQuantity(), i.getUnitPrice(), i.getLineAmount()))
                .toList();
        ReservationView reservation = null;
        if (p.getReservation() != null) {
            Reservation r = p.getReservation();
            reservation = new ReservationView(r.getId(), r.getShop().getName(), r.getPreferredAt(),
                    r.getItems().stream()
                            .map(i -> i.getServiceName() + (i.getOilType() == null ? "" : "(" + i.getOilType().label() + ")"))
                            .toList(),
                    r.getStatus());
        }
        return new PaymentView(p.getOrderId(), p.getOrderType().name(), p.getOrderName(), p.getAmount(), p.getStatus().name(),
                p.getMethod(), p.getPaidAt(), p.getCreatedAt(), p.getFailureMessage(), items, reservation);
    }

    // Toss 주문번호 규칙: 6~64자, 영문/숫자/-/_.
    private static String newOrderId(String kind) {
        return "RF-" + kind + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    static String mask(String paymentKey) {
        if (paymentKey == null) return null;
        return paymentKey.length() <= 8 ? "****" : paymentKey.substring(0, 6) + "****";
    }
}
