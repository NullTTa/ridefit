package com.ridefit.ridefit;

import com.ridefit.ridefit.config.VerifiedPartsSeeder;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartType;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

// 새(빈) DB(H2)에서 시더만으로 실제 상품 부품/호환/판매처가 재현되는지, 그리고 다시 돌려도 중복이 생기지 않는지.
@SpringBootTest
class VerifiedPartsSeederTest {

    @Autowired
    private VerifiedPartsSeeder seeder;
    @Autowired
    private PartRepository partRepository;
    @Autowired
    private CompatibilityRepository compatibilityRepository;
    @Autowired
    private SellerListingRepository sellerListingRepository;

    @Test
    @Transactional
    void 새_DB에서_스냅샷이_재현되고_다시_실행해도_중복되지_않는다() throws Exception {
        Part kitaco = partRepository.findByName("KITACO 캐리어").orElseThrow();
        assertThat(kitaco.getPartNumber()).isEqualTo("80-539-11530");
        assertThat(kitaco.getBrand()).isEqualTo("KITACO");
        assertThat(kitaco.getPartType()).isEqualTo(PartType.AFTERMARKET);
        assertThat(kitaco.getImageUrl()).isEqualTo("/assets/parts/kitaco-80-539-11530.jpg");

        Part screen = partRepository.findByName("H2C 슈퍼커브 110 순정 윈드스크린 (18년~) [APK76LJ-88210TA]").orElseThrow();
        assertThat(screen.getPartType()).isEqualTo(PartType.OEM);
        assertThat(screen.getAiReferenceImageUrl()).isEqualTo("/assets/parts/h2c-cub110-windscreen.png");

        // KITACO: Super Cub 110 2021 JA44 / 2023 JA59 / 2025 JA59, 제조사 근거 메모 그대로
        Map<Integer, Compatibility> byYear = compatibilityRepository.findByPartIdInWithModel(List.of(kitaco.getId())).stream()
                .collect(Collectors.toMap(c -> c.getModelYear().getYear(), c -> c));
        assertThat(byYear.keySet()).containsExactlyInAnyOrder(2021, 2023, 2025);
        assertThat(byYear.get(2021).getModelYear().getChassisCode()).isEqualTo("JA44");
        assertThat(byYear.get(2023).getModelYear().getChassisCode()).isEqualTo("JA59");
        assertThat(byYear.get(2025).getModelYear().getChassisCode()).isEqualTo("JA59");
        assertThat(byYear.get(2023).getNote()).contains("KITACO 제조사 공식 자료").contains("탠덤시트");

        // 판매처: 원본 상품명은 보존, 기계번역 상품명에는 표시명
        List<SellerListing> kitacoListings = sellerListingRepository.findByPartIdOrderByPriceAsc(kitaco.getId());
        assertThat(kitacoListings).hasSize(4);
        SellerListing emo = kitacoListings.stream().filter(l -> l.getSellerName().contains("EmoCruise")).findFirst().orElseThrow();
        assertThat(emo.getProductName()).contains("슈퍼 새끼 50110");
        assertThat(emo.getDisplayName()).isEqualTo("키타코(KITACO) 패션 리어 캐리어 (블랙) 슈퍼커브 50/110·크로스커브 50/110용 80-539-11530");
        assertThat(emo.getCheckedAt()).isNotNull();

        long parts = partRepository.count(), compat = compatibilityRepository.count(), listings = sellerListingRepository.count();
        seeder.run();
        seeder.run();
        assertThat(partRepository.count()).isEqualTo(parts);
        assertThat(compatibilityRepository.count()).isEqualTo(compat);
        assertThat(sellerListingRepository.count()).isEqualTo(listings);
    }
}
