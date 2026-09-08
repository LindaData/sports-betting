import { SportPage } from "@/components/SportPage";
import { mapEspnGames, mapEspnStandings } from "@/lib/espn";

export default function NBA() {
  return (
    <SportPage
      title="NBA"
      subtitle="Schedule, scores, and standings. Not betting advice."
      liveKey="nba_live"
      gamesKey="nba_schedule"
      standingsKey="nba_standings_espn"
      copy={{
        gamesTitle: "Schedule & Results",
        emptyLive:
          "The NBA is in its offseason — on game nights, scores tick here through the final buzzer.",
        emptyStandings:
          "Conference standings appear here once the standings feed publishes.",
        emptyGames:
          "The NBA is in its offseason. The 2026-27 schedule lands here as soon as games are on the calendar — last season's final standings are below.",
        offlineLive:
          "Feed offline — final scores from recent games land back here once it reconnects.",
        offlineStandings:
          "Feed offline — conference tables with W-L records return here once it reconnects.",
        offlineGames:
          "Feed offline — the season schedule and final scores return here once it reconnects.",
      }}
      mapGames={mapEspnGames}
      mapStandings={mapEspnStandings}
    />
  );
}
