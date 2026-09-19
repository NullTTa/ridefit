package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.dto.ChangePasswordRequest;
import com.ridefit.ridefit.dto.MemberSummaryResponse;
import com.ridefit.ridefit.dto.UpdateNicknameRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CommentRepository;
import com.ridefit.ridefit.repository.DailyUsageRepository;
import com.ridefit.ridefit.repository.FavoriteRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberAccountService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final MyVehicleRepository myVehicleRepository;
    private final FavoriteRepository favoriteRepository;
    private final RecentPartCheckRepository recentPartCheckRepository;
    private final DailyUsageRepository dailyUsageRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;

    @Transactional
    public MemberSummaryResponse updateNickname(Long memberId, UpdateNicknameRequest request) {
        Member member = getMember(memberId);
        member.setName(request.name());
        return MemberSummaryResponse.from(member);
    }

    @Transactional
    public void changePassword(Long memberId, ChangePasswordRequest request) {
        Member member = getMember(memberId);
        if (!passwordEncoder.matches(request.currentPassword(), member.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
        }
        member.setPassword(passwordEncoder.encode(request.newPassword()));
    }

    // 회원 탈퇴. 게시글/댓글은 삭제하지 않고 작성자 연결만 끊어서(익명화) 커뮤니티 데이터는 보존한다.
    @Transactional
    public void withdraw(Long memberId) {
        Member member = getMember(memberId);

        favoriteRepository.deleteByMemberId(memberId);
        recentPartCheckRepository.deleteByMemberId(memberId);
        dailyUsageRepository.deleteByMemberId(memberId);
        myVehicleRepository.deleteAll(myVehicleRepository.findByMemberId(memberId));

        for (Post post : postRepository.findByAuthorId(memberId)) {
            post.setAuthor(null);
        }
        for (Comment comment : commentRepository.findByAuthorId(memberId)) {
            comment.setAuthor(null);
        }

        memberRepository.delete(member);
    }

    private Member getMember(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));
    }
}
