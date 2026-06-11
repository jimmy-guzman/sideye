; distinct styling for test-framework globals (bun:test, jest, vitest)
((identifier) @function.test.suite
  (#eq? @function.test.suite "describe"))

((identifier) @function.test
  (#any-of? @function.test "test" "it" "bench" "beforeAll" "beforeEach" "afterAll" "afterEach"))

((identifier) @function.test.assert
  (#eq? @function.test.assert "expect"))
