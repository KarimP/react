/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

import {prepareStackTrace} from '../ReactComponentStackFrame';

describe('Custom stack trace generation', () => {
  function normalizeTrace(stackTrace: string): string {
    return (
      stackTrace
        .replace(/\:\d+?(\:\d+)/g, ':*')
        // NodeJS doesn't output `process` module type name, which appears to
        // be used heavily as part of its async/await regenerator
        // implementation...
        .replace('process.', '')
    );
  }

  beforeEach(() => {
    Error.prepareStackTrace = undefined;
  });

  function compareCustomTraceWithV8(fn: () => void) {
    try {
      fn();
    } catch (controlError) {
      const controlStackTrace = normalizeTrace(controlError.stack);
      try {
        Error.prepareStackTrace = prepareStackTrace;
        fn();
      } catch (sampleError) {
        expect(normalizeTrace(sampleError.stack)).toBe(controlStackTrace);
      } finally {
        Error.prepareStackTrace = undefined;
      }
    }
  }

  /**
   * Stack trace should look something like:
   * Error: Test Error Message
   *     at bar (<file path>:*)
   *     at foo (<file path>:*)
   *     at <filepath>:*
   *     ...
   */
  it('should generate the same stack trace as V8 for simple function calls', () => {
    function foo() {
      bar();
    }
    function bar() {
      throw new Error('Test Error Message');
    }
    compareCustomTraceWithV8(() => foo());
  });

  /**
   * Stack trace should look something like:
   * Error: Test Error Message
   *     at Biz.qux (<file path>:*)
   *     at Object.bazFunction [as baz] (<file path>:*)
   *     at Object.bar (<file path>:*)
   *     at <file path>:*
   *     ...
   */
  it('should generate the same stack trace as V8 for namespaced function calls', () => {
    const foo = {
      bar() {
        this.baz();
      },
      baz: function bazFunction() {
        new Biz().qux();
      },
    };
    class Biz {
      qux() {
        throw new Error('Test Error Message');
      }
    }
    compareCustomTraceWithV8(() => foo.bar());
  });

  /**
   * Stack trace should look something like:
   * Error: Test Error Message
   *     at Bar.quxFunction [as qux] (<file path>:*)
   *     at new Bar (<file path>:*)
   *     at Bar.baz (<file path>:*)
   *     at <file path>:*
   *     ...
   */
  it('should generate the same stack trace as V8 for constructor calls', () => {
    const foo = {
      bar: class Bar {
        static baz() {
          return new foo.bar();
        }
        constructor() {
          this.qux();
        }
        qux = function quxFunction() {
          throw new Error('Test Error Message');
        };
      },
    };
    compareCustomTraceWithV8(() => foo.bar.baz());
  });

  /**
   * Stack trace should look something like:
   * Error: Test Error Message
   *     at eval (eval at foo (<eval_origin>:*), <file path>:*)
   *     at foo (<file path>:*)
   *     at <file path>:*
   *     ...
   */
  it('should generate the same stack trace as V8 for evals', () => {
    compareCustomTraceWithV8(function foo() {
      // This is for testing eval stack traces
      // eslint-disable-next-line no-eval
      eval("throw new Error('Test Error Message');");
    });
  });
});
