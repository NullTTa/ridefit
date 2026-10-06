package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

// 관리자 "판매처 가격 관리": 기존 seller_listing(부품 1 - N 판매처) 표를 그대로 쓰는 추가/수정/삭제/조회.
// /api/admin/** 이므로 ROLE_ADMIN만 접근 가능(SecurityConfig). 여기서 넣은 값이 부품 카드의 판매처 가격(listings-summary)에 바로 반영된다.
// 원칙: 관리자가 직접 확인한 실제 상품 페이지 주소만 저장한다 - http(s)가 아니거나 검색 결과처럼 보이는 주소는 거절한다.
@RestController
@RequestMapping("/api/admin/seller-listings")
@RequiredArgsConstructor
public class AdminSellerListingController {

    // 검색 결과/목록 페이지로 보이는 주소(상품 페이지가 아님). 경로에 search가 있거나 검색어 파라미터가 있으면 거절.
    private static final Pattern SEARCH_PATH = Pattern.compile("(^|/)(search|searchresult|s)(/|$)|/search", Pattern.CASE_INSENSITIVE);
    private static final Pattern SEARCH_QUERY = Pattern.compile("(^|&)(q|query|keyword|kwd|searchkeyword|search_keyword|k)=", Pattern.CASE_INSENSITIVE);

    private final SellerListingRepository sellerListingRepository;
    private final PartRepository partRepository;

    @GetMapping
    public List<Row> list(@RequestParam(required = false) Long partId) {
        return sellerListingRepository.findAllForAdmin(partId).stream().map(Row::from).toList();
    }

    // 판매처 이름 선택지(이미 등록된 이름). 새 판매처는 화면에서 직접 입력한다.
    @GetMapping("/sellers")
    public List<String> sellers() {
        return sellerListingRepository.findDistinctSellerNames();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Row> create(@RequestBody Request request) {
        Part part = findPart(request.partId());
        String url = validUrl(request.sourceUrl());
        if (url != null && sellerListingRepository.findFirstByPartIdAndSourceUrl(part.getId(), url).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "이 부품에 같은 상품 URL이 이미 등록돼 있어요. 기존 항목을 수정해주세요.");
        }
        SellerListing listing = SellerListing.builder()
                .part(part)
                .createdAt(LocalDateTime.now())
                .build();
        apply(listing, request, url);
        return ResponseEntity.status(HttpStatus.CREATED).body(Row.from(sellerListingRepository.save(listing)));
    }

    @PutMapping("/{id}")
    @Transactional
    public Row update(@PathVariable Long id, @RequestBody Request request) {
        SellerListing listing = sellerListingRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "판매처 가격 항목을 찾을 수 없어요."));
        Part part = findPart(request.partId());
        String url = validUrl(request.sourceUrl());
        if (url != null) {
            sellerListingRepository.findFirstByPartIdAndSourceUrl(part.getId(), url)
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(other -> {
                        throw new ApiException(HttpStatus.CONFLICT, "이 부품에 같은 상품 URL이 이미 등록돼 있어요.");
                    });
        }
        listing.setPart(part);
        apply(listing, request, url);
        return Row.from(listing);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!sellerListingRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "판매처 가격 항목을 찾을 수 없어요.");
        }
        sellerListingRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Part findPart(Long partId) {
        if (partId == null) throw new ApiException(HttpStatus.BAD_REQUEST, "부품을 선택해주세요.");
        return partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없어요."));
    }

    private void apply(SellerListing listing, Request request, String url) {
        String seller = request.sellerName() == null ? "" : request.sellerName().trim();
        if (seller.isEmpty() || seller.length() > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "판매처 이름을 입력해주세요(255자 이하).");
        }
        if (request.price() == null || request.price() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "가격은 1원 이상으로 입력해주세요(확인한 실제 판매가).");
        }
        if (request.checkedAt() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "가격 확인일을 입력해주세요.");
        }
        if (request.checkedAt().isAfter(LocalDate.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "가격 확인일은 오늘 이후로 정할 수 없어요.");
        }
        listing.setSellerName(seller);
        listing.setPrice(request.price());
        listing.setSourceUrl(url);
        listing.setCheckedAt(request.checkedAt().atStartOfDay());
    }

    // http(s) + 호스트가 있는 255자 이하 주소만. 비어 있으면 null(가격만 표시). 검색 결과 주소는 거절.
    static String validUrl(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String url = raw.trim();
        if (url.length() > 255) throw new ApiException(HttpStatus.BAD_REQUEST, "상품 URL은 255자 이하만 저장할 수 있어요.");
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "상품 URL 형식이 올바르지 않아요.");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "상품 URL은 http:// 또는 https:// 로 시작하는 실제 상품 페이지 주소여야 해요.");
        }
        String path = uri.getPath() == null ? "" : uri.getPath();
        String query = uri.getRawQuery() == null ? "" : uri.getRawQuery();
        if (SEARCH_PATH.matcher(path).find() || SEARCH_QUERY.matcher(query).find()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "검색 결과 주소로 보여요. 판매처의 실제 상품 페이지 주소를 넣어주세요.");
        }
        return url;
    }

    public record Request(Long partId, String sellerName, Integer price, String sourceUrl, LocalDate checkedAt) {
    }

    public record Row(Long id, Long partId, String partName, String sellerName, Integer price, String sourceUrl,
                      LocalDateTime checkedAt, boolean sample) {
        static Row from(SellerListing l) {
            return new Row(l.getId(), l.getPart().getId(), l.getPart().getName(), l.getSellerName(), l.getPrice(),
                    l.getSourceUrl(), l.getCheckedAt(), l.isSample());
        }
    }
}
