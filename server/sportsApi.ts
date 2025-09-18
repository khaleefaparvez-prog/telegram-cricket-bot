import { type Fixture } from "@shared/schema";
import { EntitySportService, type EntitySportMatch, type EntitySportCompetition } from './entitySportService';
import { CricketPredictionService } from './cricketPredictionService';

export interface SportsApiService {
  fetchCricketFixtures(category: string): Promise<Fixture[]>;
  fetchTennisFixtures(category: string): Promise<Fixture[]>;
}

interface ApiSportsFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
}

export class ApiSportsService implements SportsApiService {
  private apiKey: string;
  private baseUrl = 'https://v3.football.api-sports.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchCricketFixtures(category: string): Promise<Fixture[]> {
    try {
      // Use EntitySport API to fetch real cricket data
      console.log(`🏏 Fetching cricket fixtures for category: ${category} using EntitySport API`);
      
      const entitySportService = new EntitySportService();
      const predictionService = new CricketPredictionService();
      
      // Get upcoming matches from EntitySport
      const entityMatches = await entitySportService.getUpcomingMatches();
      
      // Convert EntitySport matches to our Fixture format
      const allFixtures = this.convertEntitySportMatchesToFixtures(entityMatches);
      
      // Filter by category if specified
      const filteredFixtures = category === 'all' 
        ? allFixtures 
        : allFixtures.filter((fixture: Fixture) => fixture.category === category);
        
      if (filteredFixtures.length > 0) {
        console.log(`✅ Fetched ${filteredFixtures.length} cricket fixtures from EntitySport`);
        
        // Enhance fixtures with predictions if available
        try {
          console.log('🎯 Enhancing fixtures with prediction data...');
          const enhancedFixtures = await Promise.all(
            filteredFixtures.map(async (fixture) => {
              try {
                return await predictionService.enhanceFixtureWithPredictions(fixture);
              } catch (error) {
                console.error(`❌ Failed to enhance fixture ${fixture.id}:`, error);
                return fixture;
              }
            })
          );
          
          const enhancedCount = enhancedFixtures.filter(f => (f as any).enhanced).length;
          console.log(`✅ Enhanced ${enhancedCount}/${filteredFixtures.length} fixtures with predictions`);
          return enhancedFixtures;
        } catch (error) {
          console.warn('⚠️  Prediction enhancement unavailable, returning fixtures without predictions');
          return filteredFixtures;
        }
      } else {
        console.log('⚠️  No fixtures found from EntitySport, falling back to mock data');
        return this.generateMockCricketFixtures(category);
      }
    } catch (error) {
      console.error('❌ Failed to fetch cricket fixtures from EntitySport:', error);
      console.log('🔄 Falling back to mock cricket fixtures');
      return this.generateMockCricketFixtures(category);
    }
  }

  async fetchTennisFixtures(category: string): Promise<Fixture[]> {
    // For demo purposes, we'll simulate tennis fixtures  
    // In production, you'd use a tennis-specific API
    return this.generateMockTennisFixtures(category);
  }

  /**
   * Convert EntitySport matches to our Fixture format
   */
  private convertEntitySportMatchesToFixtures(entityMatches: EntitySportMatch[]): Fixture[] {
    return entityMatches.map((match) => {
      // Determine category based on competition details
      let category = 'international';
      if (match.competition?.category) {
        if (match.competition.category === 'domestic') {
          category = 'domestic';
        } else if (match.competition.title?.toLowerCase().includes('t20') || 
                   match.competition.abbr?.toLowerCase().includes('t20')) {
          category = 't20';
        }
      }

      // Format date and time
      const matchDate = new Date(match.date_start);
      const date = matchDate.toISOString().split('T')[0];
      const time = matchDate.toTimeString().slice(0, 5);

      // Determine status
      let status = 'upcoming';
      if (match.status === 'live') {
        status = 'live';
      } else if (match.status === 'result') {
        status = 'completed';
      }

      return {
        id: `entitysport_${match.mid}`,
        sport: 'cricket',
        category,
        series: match.competition?.title || 'Unknown Series',
        team1: match.teama?.title || match.teama?.abbr || 'Team A',
        team2: match.teamb?.title || match.teamb?.abbr || 'Team B',
        venue: match.venue?.name || 'Unknown Venue',
        date,
        time,
        status,
        tournament: match.competition?.abbr || match.competition?.title || 'Unknown Tournament',
        externalId: match.mid.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as Fixture;
    });
  }

  private async makeApiRequest(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'v3.football.api-sports.io'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Sports API request error:', error);
      throw error;
    }
  }

  private generateMockCricketFixtures(category: string): Fixture[] {
    const fixtures: Fixture[] = [];
    const teams = {
      international: [
        { team1: "India", team2: "Australia" },
        { team1: "England", team2: "New Zealand" },
        { team1: "Pakistan", team2: "South Africa" },
        { team1: "Bangladesh", team2: "Sri Lanka" },
        { team1: "West Indies", team2: "Afghanistan" }
      ],
      domestic: [
        { team1: "Mumbai Indians", team2: "Chennai Super Kings" },
        { team1: "Royal Challengers", team2: "Delhi Capitals" },
        { team1: "Yorkshire", team2: "Lancashire" },
        { team1: "Victoria", team2: "New South Wales" }
      ],
      t20: [
        { team1: "Barbados Royals", team2: "Guyana Amazon Warriors" },
        { team1: "Jamaica Tallawahs", team2: "St Lucia Kings" },
        { team1: "Melbourne Stars", team2: "Sydney Sixers" },
        { team1: "Perth Scorchers", team2: "Adelaide Strikers" }
      ]
    };

    const venues = [
      "Lord's Cricket Ground", "Eden Gardens", "MCG", "Oval",
      "Wankhede Stadium", "Old Trafford", "Headingley", "WACA"
    ];

    const tournaments = {
      international: ["Test Championship", "ODI Series", "T20I Series"],
      domestic: ["IPL", "County Championship", "Sheffield Shield"],
      t20: ["CPL", "BBL", "Vitality Blast", "IPL"]
    };

    const categoryTeams = teams[category as keyof typeof teams] || teams.international;
    const categoryTournaments = tournaments[category as keyof typeof tournaments] || tournaments.international;

    for (let i = 0; i < 8; i++) {
      const teamPair = categoryTeams[i % categoryTeams.length];
      const date = new Date();
      // Create some fixtures for today and some for future days
      if (i < 3) {
        // First 3 fixtures are today with different times
        date.setDate(date.getDate());
      } else {
        // Rest are future days
        date.setDate(date.getDate() + (i - 2));
      }
      
      fixtures.push({
        id: `cricket_${category}_${i}`,
        sport: "cricket",
        category,
        series: `${teamPair.team1} vs ${teamPair.team2} ${categoryTournaments[i % categoryTournaments.length]} Series 2024`,
        team1: teamPair.team1,
        team2: teamPair.team2,
        venue: venues[i % venues.length],
        date: date.toISOString().split('T')[0],
        time: `${14 + (i % 6)}:00`,
        status: i === 0 ? "live" : "upcoming",
        tournament: categoryTournaments[i % categoryTournaments.length],
        externalId: `ext_cricket_${i}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return fixtures;
  }

  private generateMockTennisFixtures(category: string): Fixture[] {
    const fixtures: Fixture[] = [];
    const players = {
      atp: [
        { team1: "Novak Djokovic", team2: "Rafael Nadal" },
        { team1: "Carlos Alcaraz", team2: "Jannik Sinner" },
        { team1: "Daniil Medvedev", team2: "Alexander Zverev" },
        { team1: "Stefanos Tsitsipas", team2: "Taylor Fritz" }
      ],
      wta: [
        { team1: "Iga Swiatek", team2: "Aryna Sabalenka" },
        { team1: "Coco Gauff", team2: "Jessica Pegula" },
        { team1: "Elena Rybakina", team2: "Ons Jabeur" },
        { team1: "Caroline Garcia", team2: "Petra Kvitova" }
      ],
      itf: [
        { team1: "Alex Johnson", team2: "Maria Rodriguez" },
        { team1: "David Chen", team2: "Sophie Williams" },
        { team1: "Luis Martinez", team2: "Anna Kowalski" },
        { team1: "Tom Anderson", team2: "Lisa Zhang" }
      ]
    };

    const venues = [
      "Centre Court", "Arthur Ashe Stadium", "Court Philippe-Chatrier", "Rod Laver Arena",
      "Court Central", "Stadium 1", "Court 1", "Grandstand"
    ];

    const tournaments = {
      atp: ["ATP Masters 1000", "ATP 500", "ATP 250", "Grand Slam"],
      wta: ["WTA 1000", "WTA 500", "WTA 250", "Grand Slam"],
      itf: ["ITF Men's", "ITF Women's", "ITF Junior", "ITF Futures"]
    };

    const categoryPlayers = players[category as keyof typeof players] || players.atp;
    const categoryTournaments = tournaments[category as keyof typeof tournaments] || tournaments.atp;

    for (let i = 0; i < 6; i++) {
      const playerPair = categoryPlayers[i % categoryPlayers.length];
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      fixtures.push({
        id: `tennis_${category}_${i}`,
        sport: "tennis",
        category,
        series: `${categoryTournaments[i % categoryTournaments.length]} 2024`,
        team1: playerPair.team1,
        team2: playerPair.team2,
        venue: venues[i % venues.length],
        date: date.toISOString().split('T')[0],
        time: `${12 + (i % 8)}:00`,
        status: i === 0 ? "live" : "upcoming",
        tournament: categoryTournaments[i % categoryTournaments.length],
        externalId: `ext_tennis_${i}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return fixtures;
  }
}

export function createSportsApiService(apiKey?: string): SportsApiService {
  // Always return a service instance - it will use RapidAPI for cricket fixtures
  // with the configured RAPIDAPI_KEY
  return new ApiSportsService(apiKey || '');
}