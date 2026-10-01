package com.ridefit.ridefit.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

// "AI로 장착해보기"가 쓸 이미지 API를 고른다(OpenAI / Gemini / Magic Hour). AiFitService는 어느 쪽인지 몰라도 된다.
//  - ai.fit.provider=auto(기본): OpenAI 키가 있으면 OpenAI(기존 동작 그대로), 없고 Gemini 키가 있으면 Gemini,
//    둘 다 없고 Magic Hour 키가 있으면 Magic Hour.
//  - ai.fit.provider=openai | gemini | magichour: 그 제공자만 쓴다(키가 없으면 "설정 안 됨").
@Component
@RequiredArgsConstructor
public class AiImageProvider {

    private static final String OPENAI = "openai";
    private static final String GEMINI = "gemini";
    private static final String MAGICHOUR = "magichour";

    private final OpenAiImageClient openAiImageClient;
    private final GeminiImageClient geminiImageClient;
    private final MagicHourImageClient magicHourImageClient;

    @Value("${ai.fit.provider:auto}")
    private String provider;

    private String selected() {
        String p = provider == null ? "auto" : provider.trim().toLowerCase();
        if (p.equals(OPENAI) || p.equals(GEMINI) || p.equals(MAGICHOUR)) return p;
        if (openAiImageClient.isConfigured()) return OPENAI;
        if (geminiImageClient.isConfigured()) return GEMINI;
        if (magicHourImageClient.isConfigured()) return MAGICHOUR;
        return OPENAI;
    }

    public boolean isConfigured() {
        return switch (selected()) {
            case GEMINI -> geminiImageClient.isConfigured();
            case MAGICHOUR -> magicHourImageClient.isConfigured();
            default -> openAiImageClient.isConfigured();
        };
    }

    public String model() {
        return switch (selected()) {
            case GEMINI -> geminiImageClient.model();
            case MAGICHOUR -> magicHourImageClient.model();
            default -> openAiImageClient.model();
        };
    }

    // 캐시 키/기록용. Gemini는 품질 옵션이 없어 고정 값, Magic Hour는 해상도 설정을 쓴다.
    public String quality() {
        return switch (selected()) {
            case GEMINI -> "default";
            case MAGICHOUR -> magicHourImageClient.resolution();
            default -> openAiImageClient.quality();
        };
    }

    public byte[] edit(List<OpenAiImageClient.InputImage> images, String prompt) throws IOException, InterruptedException {
        return edit(images, prompt, null);
    }

    // 결과 비율로 지정할 수 있는 값. 비어 있으면 비율 지정/차량 framing을 하지 않는다(OpenAI/Gemini = 예전 동작 그대로).
    public List<String> supportedAspectRatios() {
        return selected().equals(MAGICHOUR) ? magicHourImageClient.supportedAspectRatios() : List.of();
    }

    // aspectRatio: 원하는 결과 비율(예: "1:1"). 지금은 Magic Hour만 지원한다 - OpenAI/Gemini는 예전처럼 무시.
    public byte[] edit(List<OpenAiImageClient.InputImage> images, String prompt, String aspectRatio)
            throws IOException, InterruptedException {
        return switch (selected()) {
            case GEMINI -> geminiImageClient.edit(images, prompt);
            case MAGICHOUR -> magicHourImageClient.edit(images, prompt, aspectRatio);
            default -> openAiImageClient.edit(images, prompt);
        };
    }
}
