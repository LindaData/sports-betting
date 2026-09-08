import { SportPage } from "@/components/SportPage";
import { mapEspnGames, mapEspnStandings } from "@/lib/espn";

export default function NHL() {
  return (
    <SportPage
      title="NHL"
      subtitle="Preseason schedule, scores, and standings. Not betting advice."
      liveKey="nhl_live"
      gamesKey="nhl_schedule"
      standingsKey="nhl_standings"
      copy={{
        gamesTitle: "Schedule & Results",
        emptyLive:
          "No games in progress. Preseason play opens September 19 — scores tick here once the puck drops.",
        emptyStandings:
          "Standings appear here once the new season's tables publish.",
        emptyGames:
          "The preseason and regular-season schedule lands here once the games feed connects.",
        offlineLive:
          "Feed offline — live scores return here on their own once it reconnects.",
        offlineStandings:
          "Feed offline — standings tables return here once it reconnects.",
        offlineGames:
          "Feed offline — the schedule and final scores return here once it reconnects.",
      }}
      mapGames={mapEspnGames}
      mapStandings={mapEspnStandings}
    />
  );
}
