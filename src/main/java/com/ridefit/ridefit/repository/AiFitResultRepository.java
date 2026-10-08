package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.AiFitResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiFitResultRepository extends JpaRepository<AiFitResult, Long> {

    // 같은 조합으로 여러 번 만들 수 있으므로 가장 최근 결과를 쓴다.
    Optional<AiFitResult> findFirstByCacheKeyOrderByCreatedAtDescIdDesc(String cacheKey);

    long countByCreatedAtAfter(LocalDateTime since);

    // 서비스 전체 일일 AI 생성 한도용 - 직접 합성(model = excludedModel, AI 호출 없음) 결과는 세지 않는다.
    @Query("select count(r) from AiFitResult r where r.createdAt > :since and (r.model is null or r.model <> :excludedModel)")
    long countGeneratedSince(@Param("since") LocalDateTime since, @Param("excludedModel") String excludedModel);

    // 같은 이미지 파일을 가리키는 결과 수(삭제할 때 다른 결과가 같은 파일을 쓰면 파일은 남긴다).
    long countByGeneratedImage(String generatedImage);

    // 내 차량으로 만든 결과(최신순). 차량 id가 저장되기 전의 예전 결과는 "같은 회원 + 같은 차종"으로 함께 보여준다.
    @Query("select r from AiFitResult r where r.myVehicleId = :myVehicleId"
            + " or (r.myVehicleId is null and r.requestedByMemberId = :memberId and r.vehicleModel.id = :vehicleModelId)"
            + " order by r.createdAt desc, r.id desc")
    List<AiFitResult> findForMyVehicle(@Param("myVehicleId") Long myVehicleId, @Param("memberId") Long memberId,
                                       @Param("vehicleModelId") Long vehicleModelId);
}
