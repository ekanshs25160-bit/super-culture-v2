import { useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export const useAudio = () => {
  return useContext(AudioContext);
};

export default useAudio;

