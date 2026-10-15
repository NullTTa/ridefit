package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Part;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long> {

    List<Part> findByCategory(String category);

    Optional<Part> findByName(String name);

    // 홈 "인기 부품": 실제로 쌓인 조회수 + 장착해보기(x3)만으로 순위를 매기고, 신호가 0인 부품은 제외한다.
    @Query("select p from Part p where (p.viewCount + p.fitSelectionCount * 3) > 0 "
            + "order by (p.viewCount + p.fitSelectionCount * 3) desc, p.id desc")
    List<Part> findPopular(Pageable pageable);

    // 조회수 / 장착 시도 수를 DB에서 바로 +1 한다(서로 다른 지표라 따로 센다). 예전처럼 "읽고 +1 해서 저장"하면 동시 요청에서 값이 빠지고,
    // MariaDB 11.8(스냅샷 격리)에서는 읽은 뒤 바뀐 행을 다시 쓰려다 오류 1020이 났다. 반환값 = 바뀐 행 수(0이면 그 부품이 없음).
    // clearAutomatically: 같은 요청에서 이미 읽어 둔 Part가 있으면 옛 값으로 남지 않게 영속성 컨텍스트를 비운다.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Part p set p.viewCount = p.viewCount + 1 where p.id = :id")
    int incrementViewCount(@Param("id") Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Part p set p.fitSelectionCount = p.fitSelectionCount + 1 where p.id = :id")
    int incrementFitSelectionCount(@Param("id") Long id);
}
