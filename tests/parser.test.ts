import { Parser } from '../src/parser';

describe('Parser', () => {
  it('case 1: normal pytest failure', () => {
    const log = `
============================= test session starts ==============================
collected 1 item

tests/test_basic.py F                                                    [100%]

=================================== FAILURES ===================================
_________________________________ test_basic_math _________________________________

    def test_basic_math():
        x = 1
        y = 2
>       assert x + y == 4
E       AssertionError: assert 3 == 4

tests/test_basic.py:5: AssertionError
=========================== short test summary info ============================
FAILED tests/test_basic.py::test_basic_math - AssertionError: assert 3 == 4
`;
    const context = Parser.parse(log);
    expect(context.testName).toBe('test_basic_math');
    expect(context.errorType).toBe('AssertionError');
    expect(context.errorMessage).toBe('assert 3 == 4');
    expect(context.sourceLocations).toContain('tests/test_basic.py:5');
    expect(context.relevantLogLines.some(l => l.includes('assert x + y == 4'))).toBe(true);
  });

  it('case 2: assertion failure with message', () => {
    const log = `
_______________________________ test_status_code _______________________________

    def test_status_code():
        response = get_data()
>       assert response.status_code == 200, "Expected 200 OK"
E       AssertionError: Expected 200 OK
E       assert 404 == 200

tests/api/test_routes.py:12: AssertionError
`;
    const context = Parser.parse(log);
    expect(context.testName).toBe('test_status_code');
    expect(context.errorType).toBe('AssertionError');
    expect(context.errorMessage).toBe('Expected 200 OK');
    expect(context.sourceLocations).toContain('tests/api/test_routes.py:12');
  });

  it('case 3: exception traceback', () => {
    const log = `
Traceback (most recent call last):
  File "src/main.py", line 42, in <module>
    process_data(None)
  File "src/utils.py", line 10, in process_data
    return data.split()
AttributeError: 'NoneType' object has no attribute 'split'
`;
    const context = Parser.parse(log);
    expect(context.errorType).toBe('AttributeError');
    expect(context.errorMessage).toBe("'NoneType' object has no attribute 'split'");
    expect(context.sourceLocations).toContain('src/main.py:42');
    expect(context.sourceLocations).toContain('src/utils.py:10');
  });

  it('case 4: multiple failures', () => {
    const log = `
=================================== FAILURES ===================================
__________________________________ test_first __________________________________

    def test_first():
>       raise ValueError("First failed")
E       ValueError: First failed

test_multiple.py:3: ValueError
_________________________________ test_second __________________________________

    def test_second():
>       raise TypeError("Second failed")
E       TypeError: Second failed

test_multiple.py:6: TypeError
`;
    // For simplicity, our basic parser might just grab the first one it finds 
    // depending on implementation, but it shouldn't crash. Let's see what it extracts.
    const context = Parser.parse(log);
    expect(context.errorType).toBe('ValueError'); // First error encountered
    expect(context.testName).toBe('test_first');
    expect(context.sourceLocations).toContain('test_multiple.py:3');
    expect(context.sourceLocations).toContain('test_multiple.py:6'); // It aggregates source locations
  });

  it('case 5: malformed/incomplete log', () => {
    const log = `
Just some random text
No tracebacks, no errors
`;
    const context = Parser.parse(log);
    expect(context.errorType).toBeUndefined();
    expect(context.testName).toBeUndefined();
    expect(context.sourceLocations.length).toBe(0);
    expect(context.rawLog).toBe(log);
  });
});
