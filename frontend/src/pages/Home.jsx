import BottomDiscoveryRow from '../components/BottomDiscoveryRow';

/**
 * Home Page
 * Confines BottomDiscoveryRow to the center column docked at the bottom,
 * leaving the middle canvas completely open for the hero Wordmark and background grid.
 */
export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-end w-full min-h-0 overflow-hidden pb-24 sm:pb-28">
      <BottomDiscoveryRow />
    </div>
  );
}
