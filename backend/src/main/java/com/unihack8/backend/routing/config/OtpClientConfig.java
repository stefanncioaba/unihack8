package com.unihack8.backend.routing.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP client used to call OpenTripPlanner, with short timeouts so a slow OTP never hangs our API. */
@Configuration
@EnableConfigurationProperties(OtpProperties.class)
public class OtpClientConfig {

    // RestClient pointed at the OTP server with the configured timeouts.
    @Bean
    public RestClient otpRestClient(OtpProperties otp) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(otp.connectTimeout());
        requestFactory.setReadTimeout(otp.readTimeout());
        return RestClient.builder()
                .baseUrl(otp.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }
}
