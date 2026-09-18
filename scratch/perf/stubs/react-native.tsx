import React from 'react';
export const View = (p: any) => React.createElement('View', p, p.children);
export const Text = (p: any) => React.createElement('Text', p, p.children);
export const Pressable = (p: any) => React.createElement('Pressable', p, p.children);
export const TextInput = (p: any) => React.createElement('TextInput', p);
export const StyleSheet = {
  create: (s: any) => s,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.flat(9).filter(Boolean)) : s),
};
export const Platform = { OS: 'ios', select: (o: any) => o.ios ?? o.default };
export const AppState = { addEventListener: () => ({ remove() {} }), currentState: 'active' };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
export const Animated = { View, Text, createAnimatedComponent: (c: any) => c };
export const Easing = {};
export const InteractionManager = { runAfterInteractions: (f: any) => { f(); return { cancel() {} }; } };
