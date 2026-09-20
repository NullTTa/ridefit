package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.FinderDtos;
import com.ridefit.ridefit.service.VehicleRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// "성향으로 알아보는 나의 오토바이" 성향 테스트. 로그인 없이 누구나 해볼 수 있고, 결과는 저장하지 않는다.
@RestController
@RequiredArgsConstructor
public class FinderController {

    private final VehicleRecommendationService recommendationService;

    @GetMapping("/api/finder/questions")
    public FinderDtos.QuestionsResponse questions() {
        return recommendationService.questions();
    }

    @PostMapping("/api/finder/result")
    public FinderDtos.ResultResponse result(@RequestBody FinderDtos.ResultRequest request) {
        return recommendationService.evaluate(request.answers());
    }
}
