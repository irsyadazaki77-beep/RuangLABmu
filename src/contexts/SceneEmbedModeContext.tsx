import React, { createContext, useContext } from 'react';

export type SceneEmbedMode = 'full' | 'dual' | 'pip';

const SceneEmbedModeContext = createContext<SceneEmbedMode>('full');

export const SceneEmbedModeProvider: React.FC<{
  mode: SceneEmbedMode;
  children: React.ReactNode;
}> = ({ mode, children }) => (
  <SceneEmbedModeContext.Provider value={mode}>
    {children}
  </SceneEmbedModeContext.Provider>
);

export function useSceneEmbedMode(): SceneEmbedMode {
  return useContext(SceneEmbedModeContext);
}
