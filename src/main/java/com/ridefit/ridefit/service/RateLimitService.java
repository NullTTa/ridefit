package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.DailyUsage;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.DailyUsageRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

// 사용자 1명당 "링크 크롤링 + AI 이미지 합성" 요청을 하루 20회로 합산 제한한다.
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private static final int DAILY_LIMIT = 20;

    private final DailyUsageRepository dailyUsageRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public void checkAndIncrement(Long memberId) {
        LocalDate today = LocalDate.now();
        DailyUsage usage = dailyUsageRepository.findByMemberIdAndUsageDate(memberId, today)
                .orElseGet(() -> DailyUsage.builder()
                        .member(memberRepository.getReferenceById(memberId))
                        .usageDate(today)
                        .count(0)
                        .build());

        if (usage.getCount() >= DAILY_LIMIT) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "오늘의 요청 한도(" + DAILY_LIMIT + "회)를 모두 사용했어요. 내일 다시 시도해주세요.");
        }

        usage.setCount(usage.getCount() + 1);
        dailyUsageRepository.save(usage);
    }
}
