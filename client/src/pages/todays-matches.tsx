import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import FixtureCard from "@/components/fixture-card";

type Fixture = {
  id: string;
  sport: string;
  category: string;
  series: string;
  team1: string;
  team2: string;
  venue: string;
  date: string;
  time: string;
  status: string;
  tournament: string;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
};

export default function TodaysMatches() {
  // Fetch all fixtures 
  const { data: allFixtures = [], isLoading } = useQuery({
    queryKey: ['/api/fixtures/all'],
    queryFn: async () => {
      const response = await fetch(`/api/fixtures`);
      if (!response.ok) throw new Error('Failed to fetch fixtures');
      return response.json() as Promise<Fixture[]>;
    },
  });

  // Filter today's matches (all sports)
  const getTodaysMatches = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    return allFixtures.filter(fixture => {
      const isToday = fixture.date === todayStr;
      const isUpcomingOrLive = fixture.status === "upcoming" || fixture.status === "live";
      
      return isToday && isUpcomingOrLive;
    });
  };

  const todaysMatches = getTodaysMatches();
  const cricketMatches = todaysMatches.filter(f => f.sport === "cricket");
  const tennisMatches = todaysMatches.filter(f => f.sport === "tennis");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Today's Matches</h1>
        </div>
        <div className="text-center py-8">Loading matches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Today's Matches</h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysMatches.length}</div>
            <p className="text-xs text-muted-foreground">All sports</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cricket</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{cricketMatches.length}</div>
            <p className="text-xs text-muted-foreground">Matches today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tennis</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{tennisMatches.length}</div>
            <p className="text-xs text-muted-foreground">Matches today</p>
          </CardContent>
        </Card>
      </div>

      {/* Cricket Matches */}
      {cricketMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            Cricket Matches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cricketMatches.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </div>
      )}

      {/* Tennis Matches */}
      {tennisMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Tennis Matches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tennisMatches.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </div>
      )}

      {/* No matches today */}
      {todaysMatches.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Matches Today</h3>
            <p className="text-muted-foreground">
              There are no scheduled matches for today. Check back tomorrow!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}