package com.ridefit.ridefit.service;

import com.ridefit.ridefit.repository.AiFitResultRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

// 장착 모습 이미지 파일("/uploads/ai-fit/...")을 지워도 되는지 판단한다.
// 문자열 주소로 이미지를 저장하는 곳(다른 장착 결과, 부품 대표/AI 참조 이미지, 게시글 사진, 차종 이미지, 판매처 이미지)
// 중 하나라도 같은 주소를 쓰면 "참조 중"이다 - 그 파일은 남긴다. DB 행을 지운 뒤(flush 후)에 불러야 지운 행은 세지 않는다.
@Component
@RequiredArgsConstructor
public class AiFitImageReferences {

    private final AiFitResultRepository aiFitResultRepository;
    private final PartRepository partRepository;
    private final PostRepository postRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final SellerListingRepository sellerListingRepository;

    public boolean isReferenced(String imageUrl) {
        return aiFitResultRepository.countByGeneratedImage(imageUrl) > 0
                || partRepository.existsByImageUrl(imageUrl)
                || partRepository.existsByAiReferenceImageUrl(imageUrl)
                || postRepository.existsByImageUrl(imageUrl)
                || vehicleModelRepository.existsByImageUrl(imageUrl)
                || sellerListingRepository.existsByThumbnailUrlOrOriginalImageUrl(imageUrl, imageUrl);
    }
}
