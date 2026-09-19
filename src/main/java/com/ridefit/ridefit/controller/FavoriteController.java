package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Favorite;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.FavoriteResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.FavoriteRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.security.CurrentMember;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/me/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteRepository favoriteRepository;
    private final PartRepository partRepository;
    private final MemberRepository memberRepository;
    private final CurrentMember currentMember;

    @GetMapping
    public List<FavoriteResponse> list() {
        return favoriteRepository.findByMemberIdOrderByCreatedAtDesc(currentMember.id()).stream()
                .map(FavoriteResponse::from).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Void> add(@RequestBody FavoriteRequest request) {
        if (favoriteRepository.existsByMemberIdAndPartId(currentMember.id(), request.partId())) {
            return ResponseEntity.noContent().build();
        }
        Part part = partRepository.findById(request.partId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));

        Favorite favorite = Favorite.builder()
                .member(memberRepository.getReferenceById(currentMember.id()))
                .part(part)
                .createdAt(LocalDateTime.now())
                .build();
        favoriteRepository.save(favorite);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{partId}")
    @Transactional
    public ResponseEntity<Void> remove(@PathVariable Long partId) {
        favoriteRepository.deleteByMemberIdAndPartId(currentMember.id(), partId);
        return ResponseEntity.noContent().build();
    }

    public record FavoriteRequest(Long partId) {
    }
}
