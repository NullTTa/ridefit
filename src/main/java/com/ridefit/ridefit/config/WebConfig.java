package com.ridefit.ridefit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// React 개발 서버(http://localhost:5173)는 백엔드(http://localhost:8080)와 origin이 달라서,
// 브라우저가 기본적으로 fetch/axios 요청을 CORS 정책으로 차단한다.
// 개발 단계에서 프론트엔드가 /api/** 를 자유롭게 호출할 수 있도록 이 origin만 허용해준다.
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173")
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
