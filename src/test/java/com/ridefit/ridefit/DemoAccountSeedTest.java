package com.ridefit.ridefit;

import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.PartRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

// 데모 계정 시드는 명시적으로 켰을 때만 만든다(ridefit.seed.demo-accounts, 기본 false).
// 공개 서버에서 비밀번호가 코드에 공개된 기본 관리자/테스트 계정이 자동으로 생기지 않는지 확인한다.
// 다른 테스트와 같은 H2 DB를 쓰면 이미 만들어진 계정이 보이므로 이 테스트만 별도 인메모리 DB를 쓴다.
@SpringBootTest(properties = {
        "ridefit.seed.demo-accounts=false",
        "ridefit.seed.admin-emails=not-registered@ridefit.test",
        "spring.datasource.url=jdbc:h2:mem:ridefit-no-demo-accounts;MODE=MySQL;DB_CLOSE_DELAY=-1",
})
class DemoAccountSeedTest {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private PartRepository partRepository;

    @Test
    void 기본값에서는_데모_계정과_관리자_계정을_만들지_않는다() {
        assertThat(memberRepository.findByEmail("admin@ridefit.dev")).isEmpty();
        assertThat(memberRepository.findByEmail("user@ridefit.dev")).isEmpty();
        // 관리자 지정 설정은 이미 가입한 회원의 역할만 바꾼다 - 없는 이메일로 계정을 만들지 않는다.
        assertThat(memberRepository.findByEmail("not-registered@ridefit.test")).isEmpty();
        assertThat(memberRepository.count()).isZero();
        // 차량/부품 카탈로그 시드는 그대로 들어간다.
        assertThat(partRepository.findByName("순정 스타일 스테인리스 머플러 (Cub 110)")).isPresent();
    }
}
