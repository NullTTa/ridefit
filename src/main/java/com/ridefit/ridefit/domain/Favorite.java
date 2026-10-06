package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// "부품 찾아보기" 화면에서 부품을 저장(북마크)해두는 기능. 어느 내 차량에 저장했는지(myVehicle)를 함께 기록한다.
// myVehicle이 null인 행 = 차량 구분이 생기기 전에 저장한 예전 즐겨찾기(어느 차량인지 알 수 없으므로 추측해서 채우지 않는다).
// 주의: 예전 DB에는 (member_id, part_id) UNIQUE 인덱스가 남아 있다(ddl-auto=update는 제약을 지우지 않음) - 같은 부품을
// 두 차량에 저장하려면 그 인덱스를 지워야 한다(WORK_LOG 참고).
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "my_vehicle_id", "part_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    private Part part;

    @ManyToOne(fetch = FetchType.LAZY)
    private MyVehicle myVehicle;

    private LocalDateTime createdAt;
}
