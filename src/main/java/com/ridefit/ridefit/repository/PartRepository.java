package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Part;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long> {

    List<Part> findByCategory(String category);

    Optional<Part> findByName(String name);

    // 홈 "인기 부품": 실제로 쌓인 조회수 + 장착해보기(x3)만으로 순위를 매기고, 신호가 0인 부품은 제외한다.
    @Query("select p from Part p where (p.viewCount + p.fitSelectionCount * 3) > 0 "
            + "order by (p.viewCount + p.fitSelectionCount * 3) desc, p.id desc")
    List<Part> findPopular(Pageable pageable);
}
