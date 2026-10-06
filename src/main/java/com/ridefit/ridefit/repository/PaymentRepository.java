package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Payment;
import com.ridefit.ridefit.domain.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderId(String orderId);

    boolean existsByPaymentKey(String paymentKey);

    List<Payment> findByMemberIdOrderByCreatedAtDescIdDesc(Long memberId);

    List<Payment> findByReservationIdAndStatus(Long reservationId, PaymentStatus status);
}
