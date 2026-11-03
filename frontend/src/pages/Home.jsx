import BottomDiscoveryRow from '../components/BottomDiscoveryRow';

/**
 * Home Page
 * Confines BottomDiscoveryRow to the center column docked at the bottom,
 * with natural scroll overflow and safe clearance above the fixed PlayerBar.
 */
export default function Home() {
  return (
    <div className="w-full h-full min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-between">
      {/* Dynamic top spacer to dock discovery cards at bottom on tall screens */}
      <div className="flex-1 min-h-[20px] sm:min-h-[40px] pointer-events-none" />

      {/* Discovery Cards with safe bottom clearance above fixed PlayerBar */}
      <div className="w-full shrink-0 pt-2 pb-36 sm:pb-36 md:pb-28">
        <BottomDiscoveryRow />
      </div>
    </div>
  );
}
