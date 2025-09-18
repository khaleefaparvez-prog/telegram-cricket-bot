import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Fixture } from "@shared/schema";
import FixtureCard from "@/components/fixture-card";

export default function Dashboard() {
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Fetch fixtures from API (filtered by selected sport/category)
  const { data: fixtures = [], isLoading: fixturesLoading } = useQuery({
    queryKey: ['/api/fixtures', selectedSport !== "all" ? selectedSport : undefined, selectedCategory !== "all" ? selectedCategory : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSport !== "all") params.append('sport', selectedSport);
      if (selectedCategory !== "all") params.append('category', selectedCategory);
      
      const response = await fetch(`/api/fixtures?${params}`);
      if (!response.ok) throw new Error('Failed to fetch fixtures');
      return response.json() as Promise<Fixture[]>;
    },
  });

  // Fetch ALL fixtures for Quick Predict section (independent of filters)
  const { data: allFixtures = [], isLoading: allFixturesLoading } = useQuery({
    queryKey: ['/api/fixtures/all'],
    queryFn: async () => {
      const response = await fetch(`/api/fixtures`);
      if (!response.ok) throw new Error('Failed to fetch all fixtures');
      return response.json() as Promise<Fixture[]>;
    },
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Filter today's cricket matches for Quick Predict
  const todaysCricketMatches = allFixtures.filter(fixture => {
    if (fixture.sport !== "cricket" || fixture.status !== "upcoming") return false;
    
    const today = new Date();
    const matchDate = new Date(fixture.date);
    
    return (
      today.getFullYear() === matchDate.getFullYear() &&
      today.getMonth() === matchDate.getMonth() &&
      today.getDate() === matchDate.getDate()
    );
  }).slice(0, 5); // Limit to 5 matches

  const statCards = [
    {
      title: "Total Fixtures",
      value: stats?.totalFixtures || 0,
      icon: Activity,
      change: "+12% from last month",
    },
    {
      title: "Active Predictions",
      value: stats?.activePredictions || 0,
      icon: TrendingUp,
      change: "+5% from last week",
    },
    {
      title: "Bot Users",
      value: stats?.botUsers || 0,
      icon: Users,
      change: "+8% from last month",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
          Sports Prediction Dashboard
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="page-description">
          AI-powered cricket and tennis match predictions with real-time data.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} data-testid={`stat-card-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-value-${index}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`stat-change-${index}`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Predict Section - Only show if we have today's matches and not currently loading all fixtures */}
      {!allFixturesLoading && todaysCricketMatches.length > 0 && (
        <Card data-testid="quick-predict-section">
          <CardHeader>
            <CardTitle className="text-xl font-semibold" data-testid="quick-predict-title">
              🚀 Quick Predict - Today's Cricket
            </CardTitle>
            <p className="text-sm text-muted-foreground" data-testid="quick-predict-description">
              Get instant AI predictions for today's cricket matches
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaysCricketMatches.map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={selectedSport} onValueChange={setSelectedSport}>
            <SelectTrigger data-testid="sport-filter">
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="cricket">Cricket</SelectItem>
              <SelectItem value="tennis">Tennis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger data-testid="category-filter">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="international">International</SelectItem>
              <SelectItem value="domestic">Domestic</SelectItem>
              <SelectItem value="t20">T20</SelectItem>
              <SelectItem value="atp">ATP</SelectItem>
              <SelectItem value="wta">WTA</SelectItem>
              <SelectItem value="itf">ITF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fixtures Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6" data-testid="fixtures-section-title">
          All Fixtures
        </h2>
        {fixturesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse" data-testid={`skeleton-${i}`}>
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded"></div>
                    <div className="h-4 bg-muted rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : fixtures.length === 0 ? (
          <Card data-testid="no-fixtures-message">
            <CardContent className="flex items-center justify-center h-48">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No fixtures found</h3>
                <p className="text-muted-foreground">
                  No fixtures match your current filters. Try adjusting your selection.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="fixtures-grid">
            {fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}