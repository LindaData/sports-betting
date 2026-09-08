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
          "The final group tables load here once the standings feed connects.",
        emptyGames:
          "The full tournament archive — every final score with the model's pre-match win probabilities — loads here once the fixture feed connects.",
      }}
      mapGames={mapFootballGames}
      mapStandings={mapFootballStandings}
    />
  );
}
