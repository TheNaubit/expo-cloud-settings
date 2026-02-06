import React from 'react';
import TestRenderer from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type ListenerCallback = (event: { changedKeys: string[]; reason: string }) => void;

const mockListeners: ListenerCallback[] = [];

jest.mock('../ExpoCloudSettingsModule', () => ({
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn(() => null),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clear: jest.fn(),
    isAvailable: jest.fn(() => true),
    addListener: jest.fn((_event: string, callback: ListenerCallback) => {
      mockListeners.push(callback);
      return {
        remove: () => {
          const idx = mockListeners.indexOf(callback);
          if (idx >= 0) mockListeners.splice(idx, 1);
        },
      };
    }),
  },
}));

import ExpoCloudSettingsModule from '../ExpoCloudSettingsModule';
import { CloudSettingsProvider } from '../CloudSettingsProvider';
import {
  useCloudSetting,
  useCloudSettingObject,
  useCloudSettingBool,
  useCloudSettingNumber,
} from '../useCloudSetting';

const mockModule = ExpoCloudSettingsModule as jest.Mocked<typeof ExpoCloudSettingsModule>;

function emitChange(changedKeys: string[], reason = 'serverChange') {
  mockListeners.forEach((cb) => cb({ changedKeys, reason }));
}

function renderHook<T>(useHook: () => T) {
  const results: { current: T } = { current: undefined as T };
  function TestComponent() {
    results.current = useHook();
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      React.createElement(
        CloudSettingsProvider,
        null,
        React.createElement(TestComponent)
      )
    );
  });
  return {
    result: results,
    unmount: () => renderer.unmount(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
});

describe('CloudSettingsProvider', () => {
  test('registers one change listener on mount', () => {
    TestRenderer.act(() => {
      TestRenderer.create(
        React.createElement(CloudSettingsProvider, null, null)
      );
    });
    expect(mockListeners.length).toBe(1);
  });

  test('cleans up listener on unmount', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(CloudSettingsProvider, null, null)
      );
    });
    expect(mockListeners.length).toBe(1);
    TestRenderer.act(() => {
      renderer.unmount();
    });
    expect(mockListeners.length).toBe(0);
  });

  test('throws when hook used without provider', () => {
    expect(() => {
      TestRenderer.act(() => {
        TestRenderer.create(
          React.createElement(() => {
            useCloudSetting('key');
            return null;
          })
        );
      });
    }).toThrow('useCloudSetting requires <CloudSettingsProvider>');
  });
});

describe('useCloudSetting', () => {
  test('reads initial value from native', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('hello');
    const { result } = renderHook(() => useCloudSetting('greeting'));
    expect(result.current[0]).toBe('hello');
  });

  test('returns default value when native returns null', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() =>
      useCloudSetting('greeting', 'default')
    );
    expect(result.current[0]).toBe('default');
  });

  test('returns null when no default and native returns null', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSetting('greeting'));
    expect(result.current[0]).toBeNull();
  });

  test('setter updates state optimistically and calls native', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSetting('greeting'));

    TestRenderer.act(() => {
      result.current[1]('world');
    });

    expect(result.current[0]).toBe('world');
    expect(mockModule.setString).toHaveBeenCalledWith('greeting', 'world');
  });

  test('setter with null removes key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('hello');
    const { result } = renderHook(() => useCloudSetting('greeting'));

    TestRenderer.act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(mockModule.remove).toHaveBeenCalledWith('greeting');
  });

  test('external change updates state', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('old');
    const { result } = renderHook(() => useCloudSetting('greeting'));
    expect(result.current[0]).toBe('old');

    (mockModule.getString as jest.Mock).mockReturnValue('new');
    TestRenderer.act(() => {
      emitChange(['greeting']);
    });

    expect(result.current[0]).toBe('new');
  });

  test('ignores change events for other keys', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('hello');
    const { result } = renderHook(() => useCloudSetting('greeting'));

    TestRenderer.act(() => {
      emitChange(['other-key']);
    });

    expect(result.current[0]).toBe('hello');
  });

  test('multiple hooks share one provider listener', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    function DualComponent() {
      useCloudSetting('a');
      useCloudSetting('b');
      return null;
    }
    TestRenderer.act(() => {
      TestRenderer.create(
        React.createElement(
          CloudSettingsProvider,
          null,
          React.createElement(DualComponent)
        )
      );
    });
    // Only 1 listener from provider, not 2 from hooks
    expect(mockListeners.length).toBe(1);
  });
});

describe('useCloudSettingBool', () => {
  test('reads boolean from native', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('true');
    const { result } = renderHook(() => useCloudSettingBool('dark'));
    expect(result.current[0]).toBe(true);
  });

  test('setter writes boolean', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingBool('dark'));

    TestRenderer.act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(mockModule.setString).toHaveBeenCalledWith('dark', 'true');
  });

  test('returns default value', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingBool('dark', false));
    expect(result.current[0]).toBe(false);
  });
});

describe('useCloudSettingBool setter with null', () => {
  test('setting null removes key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('true');
    const { result } = renderHook(() => useCloudSettingBool('dark'));

    TestRenderer.act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(mockModule.remove).toHaveBeenCalledWith('dark');
  });
});

describe('useCloudSettingNumber setter validation', () => {
  test('setter throws on NaN', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingNumber('n'));
    expect(() => {
      TestRenderer.act(() => {
        result.current[1](NaN);
      });
    }).toThrow('value must be a finite number');
  });

  test('setter throws on Infinity', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingNumber('n'));
    expect(() => {
      TestRenderer.act(() => {
        result.current[1](Infinity);
      });
    }).toThrow('value must be a finite number');
  });
});

describe('useCloudSettingNumber setter with null', () => {
  test('setting null removes key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('42');
    const { result } = renderHook(() => useCloudSettingNumber('count'));

    TestRenderer.act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(mockModule.remove).toHaveBeenCalledWith('count');
  });
});

describe('useCloudSettingNumber', () => {
  test('reads number from native', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('42');
    const { result } = renderHook(() => useCloudSettingNumber('count'));
    expect(result.current[0]).toBe(42);
  });

  test('setter writes number', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingNumber('count'));

    TestRenderer.act(() => {
      result.current[1](99);
    });

    expect(result.current[0]).toBe(99);
    expect(mockModule.setString).toHaveBeenCalledWith('count', '99');
  });

  test('returns default value when native returns null', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingNumber('count', 0));
    expect(result.current[0]).toBe(0);
  });
});

describe('useCloudSettingObject', () => {
  test('reads object from native', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('{"name":"Alice"}');
    const { result } = renderHook(() =>
      useCloudSettingObject<{ name: string }>('user')
    );
    expect(result.current[0]).toEqual({ name: 'Alice' });
  });

  test('setter writes object', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() =>
      useCloudSettingObject<{ name: string }>('user')
    );

    TestRenderer.act(() => {
      result.current[1]({ name: 'Bob' });
    });

    expect(result.current[0]).toEqual({ name: 'Bob' });
    expect(mockModule.setString).toHaveBeenCalledWith(
      'user',
      '{"name":"Bob"}'
    );
  });

  test('round-trip serialization', () => {
    const data = { nested: { arr: [1, 2, 3] }, flag: true };
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingObject('data'));

    TestRenderer.act(() => {
      result.current[1](data);
    });

    expect(result.current[0]).toEqual(data);
  });

  test('returns default value when native returns null', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() =>
      useCloudSettingObject<{ theme: string }>('prefs', { theme: 'light' })
    );
    expect(result.current[0]).toEqual({ theme: 'light' });
  });

  test('returns default value for invalid JSON', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('not-json{');
    const { result } = renderHook(() =>
      useCloudSettingObject<{ theme: string }>('prefs', { theme: 'light' })
    );
    expect(result.current[0]).toEqual({ theme: 'light' });
  });
});

describe('useCloudSettingObject setter with null', () => {
  test('setting null removes key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('{"a":1}');
    const { result } = renderHook(() => useCloudSettingObject('obj'));

    TestRenderer.act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(mockModule.remove).toHaveBeenCalledWith('obj');
  });
});

describe('useCloudSettingObject setter validation', () => {
  test('setter throws on circular reference', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useCloudSettingObject('obj'));
    const circular: any = { a: 1 };
    circular.self = circular;
    expect(() => {
      TestRenderer.act(() => {
        result.current[1](circular);
      });
    }).toThrow('not JSON-serializable');
  });
});

describe('store cache', () => {
  test('reads native only once per key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('val');
    renderHook(() => useCloudSetting('cached'));
    // getString called once for initial read (via store.read in getSnapshot)
    const callCount = (mockModule.getString as jest.Mock).mock.calls.filter(
      (c: string[]) => c[0] === 'cached'
    ).length;
    expect(callCount).toBe(1);
  });
});
