package com.ridefit.ridefit.dto;

import java.util.List;

// 성향 테스트(질문 조회 + 결과) DTO 모음.
public final class FinderDtos {

    private FinderDtos() {
    }

    public record Option(String id, String label) {
    }

    public record Question(String id, String text, String hint, List<Option> options) {
    }

    public record QuestionsResponse(List<Question> questions) {
    }

    public record AnswerRequest(String questionId, String optionId) {
    }

    public record ResultRequest(List<AnswerRequest> answers) {
    }

    public record TraitScore(String trait, String label, int percent) {
    }

    public record RiderType(String code, String name, String tagline, String description, List<String> tips,
                            String secondaryLabel) {
    }

    public record Recommendation(
            VehicleSummaryResponse vehicle, int matchPercent, List<String> reasons, List<String> pros,
            List<String> cautions, List<SimilarVehicleResponse> similar) {
    }

    public record ResultResponse(RiderType riderType, List<TraitScore> traits, List<Recommendation> recommendations,
                                 int candidateCount) {
    }
}
