import React from 'react';
import { Composition } from 'remotion';
import { shots } from './registry.gen';
import { FontFaces } from './lib/fontFaces';

// Every shot file exports `compositionConfig` + a default component. gen-registry.mjs
// discovers them into registry.gen. This maps each to a <Composition>.
// Spec-driven shots also export defaultProps + calculateMetadata; when present we pass
// them through so the composition derives duration/fps/size from the spec. Legacy shots
// (no defaultProps/calculateMetadata) render exactly as before.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <FontFaces />
      {shots.map(({ Comp, config, defaultProps, calculateMetadata }) => {
        const specDriven = !!defaultProps && !!calculateMetadata;
        return (
          <Composition
            key={config.id}
            id={config.id}
            component={Comp as React.FC}
            durationInFrames={Math.max(1, Math.round(config.durationInSeconds * config.fps))}
            fps={config.fps}
            width={config.width}
            height={config.height}
            {...(specDriven
              ? { defaultProps, calculateMetadata }
              : {})}
          />
        );
      })}
    </>
  );
};
