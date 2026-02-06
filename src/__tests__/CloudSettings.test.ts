import {
  setString,
  getString,
  remove,
  getAllKeys,
  clear,
  isAvailable,
  setBool,
  getBool,
  setNumber,
  getNumber,
  setObject,
  getObject,
  addChangeListener,
} from '../CloudSettings';
import ExpoCloudSettingsModule from '../ExpoCloudSettingsModule';

jest.mock('../ExpoCloudSettingsModule', () => ({
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clear: jest.fn(),
    isAvailable: jest.fn(() => true),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const mockModule = ExpoCloudSettingsModule as jest.Mocked<typeof ExpoCloudSettingsModule>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('core operations', () => {
  test('setString calls native module', () => {
    setString('key', 'value');
    expect(mockModule.setString).toHaveBeenCalledWith('key', 'value');
  });

  test('getString calls native module', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('value');
    expect(getString('key')).toBe('value');
    expect(mockModule.getString).toHaveBeenCalledWith('key');
  });

  test('getString returns null for missing key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    expect(getString('missing')).toBeNull();
  });

  test('remove calls native module', () => {
    remove('key');
    expect(mockModule.remove).toHaveBeenCalledWith('key');
  });

  test('getAllKeys calls native module', () => {
    (mockModule.getAllKeys as jest.Mock).mockReturnValue(['a', 'b']);
    expect(getAllKeys()).toEqual(['a', 'b']);
  });

  test('clear calls native module', () => {
    clear();
    expect(mockModule.clear).toHaveBeenCalled();
  });

  test('isAvailable calls native module', () => {
    expect(isAvailable()).toBe(true);
    expect(mockModule.isAvailable).toHaveBeenCalled();
  });
});

describe('typed helpers', () => {
  test('setBool serializes true', () => {
    setBool('dark', true);
    expect(mockModule.setString).toHaveBeenCalledWith('dark', 'true');
  });

  test('setBool serializes false', () => {
    setBool('dark', false);
    expect(mockModule.setString).toHaveBeenCalledWith('dark', 'false');
  });

  test('getBool returns true', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('true');
    expect(getBool('dark')).toBe(true);
  });

  test('getBool returns false', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('false');
    expect(getBool('dark')).toBe(false);
  });

  test('getBool returns null for missing key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    expect(getBool('dark')).toBeNull();
  });

  test('getBool returns null for non-boolean string', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('maybe');
    expect(getBool('dark')).toBeNull();
  });

  test('setNumber serializes number', () => {
    setNumber('count', 42);
    expect(mockModule.setString).toHaveBeenCalledWith('count', '42');
  });

  test('getNumber parses number', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('42');
    expect(getNumber('count')).toBe(42);
  });

  test('getNumber handles float', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('3.14');
    expect(getNumber('pi')).toBe(3.14);
  });

  test('getNumber returns null for non-numeric', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('abc');
    expect(getNumber('count')).toBeNull();
  });

  test('getNumber returns null for missing key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    expect(getNumber('count')).toBeNull();
  });

  test('getNumber returns null for Infinity', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('Infinity');
    expect(getNumber('count')).toBeNull();
  });

  test('getNumber returns null for -Infinity', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('-Infinity');
    expect(getNumber('count')).toBeNull();
  });

  test('setObject serializes object', () => {
    setObject('user', { name: 'Alice', age: 30 });
    expect(mockModule.setString).toHaveBeenCalledWith(
      'user',
      '{"name":"Alice","age":30}'
    );
  });

  test('getObject parses object', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('{"name":"Alice","age":30}');
    expect(getObject('user')).toEqual({ name: 'Alice', age: 30 });
  });

  test('getObject returns null for invalid JSON', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('not-json{');
    expect(getObject('user')).toBeNull();
  });

  test('getObject returns null for missing key', () => {
    (mockModule.getString as jest.Mock).mockReturnValue(null);
    expect(getObject('user')).toBeNull();
  });
});

describe('input validation', () => {
  test('setString throws on empty key', () => {
    expect(() => setString('', 'value')).toThrow('key must be a non-empty string');
  });

  test('getString throws on empty key', () => {
    expect(() => getString('')).toThrow('key must be a non-empty string');
  });

  test('remove throws on empty key', () => {
    expect(() => remove('')).toThrow('key must be a non-empty string');
  });

  test('setNumber throws on Infinity', () => {
    expect(() => setNumber('n', Infinity)).toThrow('value must be a finite number');
  });

  test('setNumber throws on -Infinity', () => {
    expect(() => setNumber('n', -Infinity)).toThrow('value must be a finite number');
  });

  test('setNumber throws on NaN', () => {
    expect(() => setNumber('n', NaN)).toThrow('value must be a finite number');
  });

  test('setObject throws on circular reference', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    expect(() => setObject('o', obj)).toThrow('not JSON-serializable');
  });

  test('getNumber returns null for empty string', () => {
    (mockModule.getString as jest.Mock).mockReturnValue('');
    expect(getNumber('n')).toBeNull();
  });
});

describe('change listener', () => {
  test('addChangeListener subscribes to onStoreChanged', () => {
    const callback = jest.fn();
    addChangeListener(callback);
    expect(mockModule.addListener).toHaveBeenCalledWith(
      'onStoreChanged',
      callback
    );
  });

  test('addChangeListener returns subscription with remove', () => {
    const subscription = addChangeListener(jest.fn());
    expect(subscription.remove).toBeDefined();
  });
});
