package com.unihack8.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:unihack8test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
		"spring.datasource.driver-class-name=org.h2.Driver",
		"spring.datasource.username=sa",
		"spring.jpa.hibernate.ddl-auto=create-drop",
		"supabase.url=http://localhost:9999",
		"supabase.jwks-url=http://localhost:9999/jwks"
})
class BackendApplicationTests {

	// Confirms the API can start with an in-memory database and no Supabase connection.
	@Test
	void contextLoads() {
	}

}
