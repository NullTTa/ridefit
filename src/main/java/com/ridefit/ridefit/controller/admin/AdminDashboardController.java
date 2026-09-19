package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.dto.admin.AdminStatsResponse;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// 관리자 페이지 첫 화면에 보여줄 핵심 지표.
@RestController
@RequiredArgsConstructor
public class AdminDashboardController {

    private final MemberRepository memberRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final PartRepository partRepository;
    private final PostRepository postRepository;

    @GetMapping("/api/admin/stats")
    public AdminStatsResponse stats() {
        return new AdminStatsResponse(
                memberRepository.count(),
                myVehicleRepository.count(),
                partRepository.count(),
                postRepository.count());
    }
}
