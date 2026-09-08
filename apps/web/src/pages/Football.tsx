import { SportPage } from "@/components/SportPage";
import { mapFootballGames, mapFootballStandings } from "@/lib/football";

export default function Football() {
  return (
    <SportPage
      title="World Cup 2026"
      subtitle="The completed tournament, archived: every result, final group standings, and the model's calls. Not betting advice."
      liveKey="football_live"
      gamesKey="football_fixtures"
      standingsKey="football_standings"
      copy={{
        gamesTitle: "Results",
        standingsTitle: "Final group standings",
        emptyLive: "The tournament is over — nothing is live. Every final score is below.",
        emptyStandings:
          "The final group tables aren't available right now — they'll be back shortly.",
        emptyGames:
          "The tournament archive is temporarily unavailable. Every final score and the model's pre-match calls return here shortly.",
        offlineStandings:
          "Feed offline — the final group tables return here on their own once it reconnects.",
        offlineGames:
          "Feed offline — the tournament archive, every final score with the model's pre-match calls, returns here on its own once it reconnects.",
      }}
      mapGames={mapFootballGames}
      mapStandings={mapFootballStandings}
    />
  );
}
