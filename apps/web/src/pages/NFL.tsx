import { SportPage } from "@/components/SportPage";
import { mapEspnGames, mapEspnStandings } from "@/lib/espn";

export default function NFL() {
  return (
    <SportPage
      title="NFL"
      subtitle="Schedule, scores, and standings. Not betting advice."
      liveKey="nfl_live"
      gamesKey="nfl_schedule"
      standingsKey="nfl_standings"
      copy={{
        gamesTitle: "Schedule & Results",
        emptyLive:
          "No games in progress. On game days, scores tick here through the final whistle.",
        emptyStandings:
          "Conference standings appear here once the standings feed publishes.",
        emptyGames:
          "The season schedule and final scores land here once the games feed connects.",
        offlineLive:
          "Feed offline — live scores return here on their own once it reconnects.",
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
