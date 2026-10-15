package com.ridefit.ridefit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// React 개발 서버(http://localhost:5173)는 백엔드(http://localhost:8080)와 origin이 달라서,
// 브라우저가 기본적으로 fetch/axios 요청을 CORS 정책으로 차단한다.
// 개발 단계에서 프론트엔드가 /api/** 를 자유롭게 호출할 수 있도록 이 origin들을 허용해준다.
// 5173이 이미 다른 프로세스에 점유돼 있으면 Vite가 5174/5175로 자동으로 넘어가므로 몇 개 더 열어둔다.
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    // 배포 서버에서는 CORS_ALLOWED_ORIGINS(쉼표 구분, 예: https://ridefit.example.com)로 실제 주소를 넣는다.
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:5174,http://localhost:5175}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("*");
    }

    // 업로드된 파일(커뮤니티 사진 첨부 등)을 /uploads/** 로 그대로 서빙한다.
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + "/");
    }
}
