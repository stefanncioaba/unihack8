package com.unihack8.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** The whole application starts with the test settings (H2 database, test Supabase secret). */
@SpringBootTest
class BackendApplicationTests {

	// Fails if any bean (security, database, config) cannot be created.
	@Test
	void contextLoads() {
	}

}
