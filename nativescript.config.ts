import { NativeScriptConfig } from '@nativescript/core';

export default {
  // Permanent once published on Google Play / App Store.
  id: 'com.docsigner.signpdf.esignature',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  }
} as NativeScriptConfig;