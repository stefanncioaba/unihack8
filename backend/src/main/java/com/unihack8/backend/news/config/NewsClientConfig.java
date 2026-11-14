package com.unihack8.backend.news.config;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP client used only to read the news sites' feeds, with timeouts. */
@Configuration
@EnableConfigurationProperties(NewsProperties.class)
public class NewsClientConfig {

    // RestClient with connect/read timeouts and our User-Agent (no base URL: every site is different).
    @Bean
    public RestClient newsRestClient(NewsProperties props) {
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(props.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(props.readTimeout());
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
                .build();
    }
}
