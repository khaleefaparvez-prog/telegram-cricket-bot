import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, json, integer, real, unique, check, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const fixtures = pgTable("fixtures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(), // "cricket" or "tennis"
  category: text("category").notNull(), // "international", "domestic", "t20", "atp", "wta", "itf"
  series: text("series"), // Series name (e.g., "India vs Australia Test Series 2024")
  team1: text("team1").notNull(),
  team2: text("team2").notNull(),
  venue: text("venue").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("upcoming"), // "upcoming", "live", "completed"
  tournament: text("tournament").notNull(),
  externalId: text("external_id"), // ID from sports API
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const botSettings = pgTable("bot_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  botToken: text("bot_token"),
  entitySportApiKey: text("entitysport_api_key"), // EntitySport API key - single source for all cricket data
  updateInterval: text("update_interval").notNull().default("daily"),
  autoNotifications: boolean("auto_notifications").notNull().default(true),
  enableWeatherData: boolean("enable_weather_data").notNull().default(true),
  enableOddsData: boolean("enable_odds_data").notNull().default(true),
  webhookUrl: text("webhook_url"),
  allowedUsers: text("allowed_users"), // comma-separated usernames
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  telegramUsername: text("telegram_username"),
  preferredSports: text("preferred_sports").array().notNull().default(sql`ARRAY[]::text[]`), // ["cricket", "tennis"]
  preferredCategories: text("preferred_categories").array().notNull().default(sql`ARRAY[]::text[]`), // ["international", "domestic", etc]
  notifications: boolean("notifications").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Prediction Engine Tables

// Canonical entity tables for proper foreign key relationships
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  sport: text("sport").notNull(), // "cricket" or "tennis"
  country: text("country"),
  externalIds: json("external_ids").$type<Record<string, string>>().notNull().default(sql`'{}'::json`), // {"cricbuzz": "123", "espn": "456"}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Fixed: Include country to prevent collisions (e.g., "Titans" in different countries/leagues)
  uniqueTeamCountrySport: unique().on(table.name, table.country, table.sport),
  nameIndex: index("teams_name_idx").on(table.name),
}));

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sport: text("sport").notNull(), // "cricket" or "tennis"
  country: text("country"),
  dateOfBirth: text("date_of_birth"),
  playingRole: text("playing_role"), // "batsman", "bowler", "all-rounder" for cricket; "singles", "doubles" for tennis
  externalIds: json("external_ids").$type<Record<string, string>>().notNull().default(sql`'{}'::json`), // {"cricbuzz": "123", "atp": "456"}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Fixed: Include dateOfBirth and country to prevent collisions (e.g., multiple "Alex Smith")
  uniquePlayerIdentity: unique().on(table.name, table.dateOfBirth, table.country, table.sport),
  nameIndex: index("players_name_idx").on(table.name),
}));

// Link fixtures to teams/players with proper foreign keys
export const fixtureParticipants = pgTable("fixture_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").references(() => players.id, { onDelete: "cascade" }),
  participantType: text("participant_type").notNull(), // "team1", "team2", "player1", "player2"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure exactly one of teamId or playerId is set (XOR constraint)
  participantXorCheck: check("participant_xor_check", sql`(${table.teamId} IS NOT NULL) <> (${table.playerId} IS NOT NULL)`),
  uniqueFixtureParticipant: unique().on(table.fixtureId, table.participantType),
  fixtureIdIndex: index("fixture_participants_fixture_idx").on(table.fixtureId),
}));

// External ID mappings for canonical entity resolution
export const teamExternalIds = pgTable("team_external_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "cricbuzz", "espn", "api-sports", etc.
  externalId: text("external_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueProviderExternalId: unique().on(table.provider, table.externalId),
  teamIdIndex: index("team_external_ids_team_idx").on(table.teamId),
}));

export const playerExternalIds = pgTable("player_external_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "cricbuzz", "atp", "wta", etc.
  externalId: text("external_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueProviderExternalId: unique().on(table.provider, table.externalId),
  playerIdIndex: index("player_external_ids_player_idx").on(table.playerId),
}));

export const predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  sport: text("sport").notNull(), // "cricket" or "tennis"
  modelVersion: text("model_version").notNull().default("v1.0"),
  asOf: timestamp("as_of").notNull().defaultNow(), // When prediction was made (for live updates)
  team1WinProbability: real("team1_win_probability").notNull(),
  team2WinProbability: real("team2_win_probability").notNull(),
  drawProbability: real("draw_probability"), // For cricket (test matches)
  confidenceScore: real("confidence_score").notNull(), // 0-1 confidence level
  keyFactors: json("key_factors").$type<string[]>().notNull().default(sql`'[]'::json`), // ["team1_form", "venue_advantage", etc]
  explanations: json("explanations").$type<Array<{feature: string, value: number, shap: number}>>().notNull().default(sql`'[]'::json`), // SHAP explanations with numeric values
  predictedMargin: real("predicted_margin"), // Runs/games margin
  actualResult: text("actual_result"), // "team1" | "team2" | "draw" (filled after match)
  accuracyScore: real("accuracy_score"), // Calculated after match completion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure unique predictions per fixture/model/time
  uniquePrediction: unique().on(table.fixtureId, table.modelVersion, table.asOf),
  fixtureIdIndex: index("predictions_fixture_idx").on(table.fixtureId),
  // Covering index for latest-by-model queries
  latestPredictionIndex: index("predictions_latest_idx").on(table.fixtureId, table.modelVersion, table.asOf),
  // Database constraints for probability validation
  team1ProbCheck: check("team1_prob_check", sql`${table.team1WinProbability} >= 0 AND ${table.team1WinProbability} <= 1`),
  team2ProbCheck: check("team2_prob_check", sql`${table.team2WinProbability} >= 0 AND ${table.team2WinProbability} <= 1`),
  drawProbCheck: check("draw_prob_check", sql`${table.drawProbability} IS NULL OR (${table.drawProbability} >= 0 AND ${table.drawProbability} <= 1)`),
  confidenceCheck: check("confidence_check", sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1`),
  probSumCheck: check("prob_sum_check", sql`(${table.team1WinProbability} + ${table.team2WinProbability} + COALESCE(${table.drawProbability}, 0)) BETWEEN 0.99 AND 1.01`),
}));

export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id), // FK to teams table
  playerId: varchar("player_id").references(() => players.id), // FK to players table
  entityName: text("entity_name").notNull(), // Team/player name
  sport: text("sport").notNull(), // "cricket" or "tennis"
  context: text("context").notNull(), // For cricket: "test", "odi", "t20" | For tennis: "clay", "grass", "hard", "indoor"
  eloRating: real("elo_rating").notNull().default(1500), // Elo rating (starts at 1500)
  glickoRating: real("glicko_rating").notNull().default(1500), // Glicko-2 rating
  volatility: real("volatility").notNull().default(0.06), // Glicko-2 volatility
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  winPercentage: real("win_percentage").notNull().default(0),
  lastMatchDate: timestamp("last_match_date"),
  formRating: real("form_rating").notNull().default(1500), // Recent form (last 5-10 matches)
  peakRating: real("peak_rating").notNull().default(1500),
  peakRatingDate: timestamp("peak_rating_date"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure exactly one of teamId or playerId is set (XOR constraint)
  entityXorCheck: check("entity_xor_check", sql`(${table.teamId} IS NOT NULL) <> (${table.playerId} IS NOT NULL)`),
  // Unique ratings per entity/sport/context
  uniqueTeamRating: unique().on(table.teamId, table.sport, table.context),
  uniquePlayerRating: unique().on(table.playerId, table.sport, table.context),
  teamIdIndex: index("ratings_team_idx").on(table.teamId),
  playerIdIndex: index("ratings_player_idx").on(table.playerId),
  sportContextIndex: index("ratings_sport_context_idx").on(table.sport, table.context),
  // Covering index for latest-by-model queries
  latestRatingIndex: index("ratings_latest_idx").on(table.sport, table.context, table.updatedAt),
}));

// Rating history for backtesting and time-sliced features
export const ratingsHistory = pgTable("ratings_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratingId: varchar("rating_id").notNull().references(() => ratings.id),
  eloRating: real("elo_rating").notNull(),
  glickoRating: real("glicko_rating").notNull(),
  volatility: real("volatility").notNull(),
  matchesPlayed: integer("matches_played").notNull(),
  winPercentage: real("win_percentage").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => ({
  ratingIdIndex: index("ratings_history_rating_idx").on(table.ratingId),
  recordedAtIndex: index("ratings_history_recorded_idx").on(table.recordedAt),
}));

export const matchStatistics = pgTable("match_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  sport: text("sport").notNull(),
  team1Stats: json("team1_stats").$type<Record<string, number>>().notNull().default(sql`'{}'::json`),
  team2Stats: json("team2_stats").$type<Record<string, number>>().notNull().default(sql`'{}'::json`),
  matchStats: json("match_stats").$type<Record<string, number>>().notNull().default(sql`'{}'::json`),
  weatherConditions: json("weather_conditions").$type<{
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    precipitation?: number;
    conditions?: string;
  }>().default(sql`'{}'::json`),
  venueStats: json("venue_stats").$type<{
    surfaceType?: string;
    avgFirstInningsScore?: number;
    chaseSuccessRate?: number;
    tossBias?: string;
  }>().default(sql`'{}'::json`),
  headToHeadRecord: json("head_to_head_record").$type<{
    totalMatches: number;
    team1Wins: number;
    team2Wins: number;
    draws: number;
    lastMeetingDate?: string;
    venueRecord?: Record<string, any>;
    contextRecord?: Record<string, {matches: number, wins: number}>; // Format/surface specific H2H
  }>().default(sql`'{}'::json`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fixtureIdIndex: index("match_stats_fixture_idx").on(table.fixtureId),
}));

export const playerStats = pgTable("player_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => players.id), // FK to players table
  playerName: text("player_name").notNull(),
  sport: text("sport").notNull(),
  category: text("category").notNull(), // Format/surface context ("test", "odi", "t20")
  
  // Rolling performance windows
  rollingStats: json("rolling_stats").$type<{
    last5Matches?: Record<string, number>;
    last10Matches?: Record<string, number>;
    last20Matches?: Record<string, number>;
    currentSeason?: Record<string, number>;
  }>().notNull().default(sql`'{}'::json`),
  
  // Career statistics
  careerStats: json("career_stats").$type<Record<string, number>>().notNull().default(sql`'{}'::json`),
  
  // Cricket-specific batting statistics
  battingStats: json("batting_stats").$type<{
    // Current form metrics
    currentForm: {
      runs: number;
      matches: number;
      average: number;
      strikeRate: number;
      hundreds: number;
      fifties: number;
      notOuts: number;
      highestScore: number;
    };
    // Performance vs different bowling types
    vsPace: {
      average: number;
      strikeRate: number;
      dismissals: number;
    };
    vsSpin: {
      average: number;
      strikeRate: number;
      dismissals: number;
    };
    // Situation-specific performance
    powerplay: {
      runs: number;
      balls: number;
      strikeRate: number;
    };
    deathOvers: {
      runs: number;
      balls: number;
      strikeRate: number;
    };
    // Pressure performance
    chasing: {
      runs: number;
      matches: number;
      average: number;
      successRate: number;
    };
    defendingTotal: {
      runs: number;
      matches: number;
      average: number;
    };
    // Recent trend analysis
    form_trend: {
      last5Avg: number;
      last10Avg: number;
      trend: 'improving' | 'declining' | 'stable';
    };
  }>().default(sql`'{}'::json`),
  
  // Cricket-specific bowling statistics
  bowlingStats: json("bowling_stats").$type<{
    // Current form metrics
    currentForm: {
      wickets: number;
      overs: number;
      runs: number;
      economy: number;
      average: number;
      strikeRate: number;
      fiveWickets: number;
      fourWickets: number;
      bestFigures: string;
    };
    // Performance vs different batting styles
    vsRightHanded: {
      wickets: number;
      runs: number;
      average: number;
    };
    vsLeftHanded: {
      wickets: number;
      runs: number;
      average: number;
    };
    // Situation-specific performance
    powerplay: {
      wickets: number;
      runs: number;
      overs: number;
      economy: number;
    };
    middleOvers: {
      wickets: number;
      runs: number;
      overs: number;
      economy: number;
    };
    deathOvers: {
      wickets: number;
      runs: number;
      overs: number;
      economy: number;
    };
    // Recent trend analysis
    form_trend: {
      last5Economy: number;
      last10Economy: number;
      trend: 'improving' | 'declining' | 'stable';
    };
  }>().default(sql`'{}'::json`),
  
  // Fielding and wicket-keeping statistics
  fieldingStats: json("fielding_stats").$type<{
    catches: number;
    runOuts: number;
    stumpings?: number; // For wicket-keepers
    catchSuccessRate: number;
    droppedCatches: number;
    fielding_rating: number; // 0-10 scale
  }>().default(sql`'{}'::json`),
  
  // Performance in different conditions
  conditionStats: json("condition_stats").$type<{
    homeVenue: {
      matches: number;
      performance_rating: number;
      key_stats: Record<string, number>;
    };
    awayVenue: {
      matches: number;
      performance_rating: number;
      key_stats: Record<string, number>;
    };
    neutralVenue: {
      matches: number;
      performance_rating: number;
      key_stats: Record<string, number>;
    };
    dayMatches: {
      matches: number;
      performance_rating: number;
    };
    dayNightMatches: {
      matches: number;
      performance_rating: number;
    };
    vsTopTeams: {
      matches: number;
      performance_rating: number;
      opponents: string[];
    };
  }>().default(sql`'{}'::json`),
  
  // Player impact metrics for prediction
  impactMetrics: json("impact_metrics").$type<{
    // Player importance to team
    teamDependency: number; // 0-1 scale - how much team depends on this player
    replacementValue: number; // 0-1 scale - difficulty to replace
    
    // Clutch performance
    clutchRating: number; // Performance in high-pressure situations
    bigMatchPerformance: number; // Performance in important matches
    
    // Consistency metrics
    consistencyScore: number; // How reliable the player is
    varianceScore: number; // Performance volatility
    
    // Match-winning ability
    matchWinningContributions: number;
    playerOfMatchAwards: number;
    
    // Current prediction weight
    predictionWeight: number; // How much this player should influence team prediction
  }>().default(sql`'{}'::json`),
  
  // Enhanced form and status tracking
  recentForm: real("recent_form").notNull().default(0), // -1 to 1 form indicator
  formTrend: text("form_trend").default("stable"), // "improving", "declining", "stable"
  confidenceLevel: real("confidence_level").notNull().default(0.5), // Player's current confidence
  injuryStatus: text("injury_status").default("fit"), // "fit", "doubtful", "injured", "rested"
  availabilityStatus: text("availability_status").default("available"), // "available", "selected", "rested", "injured", "suspended"
  lastMatchDate: timestamp("last_match_date"),
  nextMatchDate: timestamp("next_match_date"),
  
  // API data tracking
  dataSource: text("data_source").default("manual"), // "roanuz", "cricketdata", "manual"
  lastApiUpdate: timestamp("last_api_update"),
  apiUpdateStatus: text("api_update_status").default("pending"), // "success", "failed", "pending"
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure unique player stats per sport/category
  uniquePlayerStats: unique().on(table.playerId, table.sport, table.category),
  playerIdIndex: index("player_stats_player_idx").on(table.playerId),
  lastApiUpdateIndex: index("player_stats_api_update_idx").on(table.lastApiUpdate),
  dataSourceIndex: index("player_stats_source_idx").on(table.dataSource),
}));

export const predictionFeatures = pgTable("prediction_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  features: json("features").$type<Record<string, number>>().notNull().default(sql`'{}'::json`), // All ML features as key-value pairs
  featureVersion: text("feature_version").notNull().default("v1.0"),
  generatedAt: timestamp("generated_at").defaultNow(),
}, (table) => ({
  // Ensure unique features per fixture/version
  uniqueFeatures: unique().on(table.fixtureId, table.featureVersion),
  fixtureIdIndex: index("prediction_features_fixture_idx").on(table.fixtureId),
}));

// Weather Data Storage
export const weatherData = pgTable("weather_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  venue: text("venue").notNull(),
  matchDate: timestamp("match_date").notNull(),
  // Current conditions at time of prediction
  temperature: real("temperature"), // Celsius
  feelsLike: real("feels_like"), // Celsius
  humidity: integer("humidity"), // Percentage
  pressure: real("pressure"), // hPa
  windSpeed: real("wind_speed"), // m/s
  windDirection: integer("wind_direction"), // degrees
  windGust: real("wind_gust"), // m/s
  visibility: real("visibility"), // meters
  cloudCover: integer("cloud_cover"), // Percentage
  precipitation: json("precipitation").$type<{
    rain1h?: number; // mm/h
    rain3h?: number; // mm/3h
    snow1h?: number; // mm/h
    snow3h?: number; // mm/3h
  }>().default(sql`'{}'::json`),
  uvIndex: real("uv_index"),
  dewPoint: real("dew_point"), // Celsius
  weatherConditions: json("weather_conditions").$type<Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>>().default(sql`'[]'::json`),
  // Cricket-specific impact factors
  cricketImpact: json("cricket_impact").$type<{
    swingBowlingAdvantage: number; // 0-1 scale
    spinBowlingAdvantage: number; // 0-1 scale
    battingConditions: number; // 0-1 scale
    fieldingConditions: number; // 0-1 scale
    pitchCondition: 'dry' | 'damp' | 'wet' | 'ideal';
    rainProbability: number; // 0-1 scale
    matchDisruptionRisk: 'low' | 'medium' | 'high';
    overallFavorability: 'bowler' | 'batsman' | 'neutral';
    weatherSummary: string;
  }>().default(sql`'{}'::json`),
  // Forecast data (for longer matches)
  hourlyForecast: json("hourly_forecast").$type<Array<{
    timestamp: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    conditions: string;
  }>>().default(sql`'[]'::json`),
  dataSource: text("data_source").notNull().default("openweathermap"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fixtureIdIndex: index("weather_data_fixture_idx").on(table.fixtureId),
  venueIndex: index("weather_data_venue_idx").on(table.venue),
  matchDateIndex: index("weather_data_date_idx").on(table.matchDate),
  uniqueWeatherData: unique().on(table.fixtureId, table.fetchedAt), // One record per fixture per fetch
}));

// =============================================================================
// COMPREHENSIVE HISTORICAL DATA STORAGE FOR ENTITYSPORT API
// =============================================================================

// Venues - Store detailed venue information and historical performance
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  
  // EntitySport venue details
  entitySportId: text("entity_sport_id").unique(),
  capacity: integer("capacity"),
  establishment: text("establishment"), // Year established
  timezone: text("timezone"),
  
  // Venue characteristics for cricket
  venueType: text("venue_type"), // "stadium", "ground", "oval"
  pitchType: text("pitch_type"), // "flat", "bouncy", "spin-friendly", "pace-friendly"
  boundaryLength: json("boundary_length").$type<{
    straight?: number;
    square?: number;
    average?: number;
  }>().default(sql`'{}'::json`),
  
  // Historical venue statistics
  historicalStats: json("historical_stats").$type<{
    totalMatches: number;
    avgFirstInningsScore: {
      test?: number;
      odi?: number;
      t20?: number;
    };
    chaseSuccessRate: number;
    tossBias: {
      batFirst: number;
      fieldFirst: number;
    };
    seasonalPerformance: Record<string, {
      matches: number;
      avgScore: number;
      result_bias: string;
    }>;
    surface_advantage: "batsman" | "bowler" | "neutral";
  }>().default(sql`'{}'::json`),
  
  // Weather and conditions
  averageWeather: json("average_weather").$type<{
    temperature: {
      summer: number;
      winter: number;
    };
    humidity: number;
    windSpeed: number;
    rainfall: number;
  }>().default(sql`'{}'::json`),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameCountryIndex: index("venues_name_country_idx").on(table.name, table.country),
  entitySportIdIndex: index("venues_entity_sport_idx").on(table.entitySportId),
}));

// Competitions/Leagues - Store detailed competition information
export const competitions = pgTable("competitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  sport: text("sport").notNull(), // "cricket", "tennis"
  category: text("category").notNull(), // "international", "domestic", "t20", etc.
  
  // EntitySport competition details
  entitySportId: text("entity_sport_id").unique(),
  competitionType: text("competition_type"), // "league", "tournament", "series"
  format: text("format"), // "test", "odi", "t20", "t10"
  
  // Competition metadata
  country: text("country"),
  organizer: text("organizer"), // "ICC", "BCCI", "ECB", etc.
  season: text("season"), // "2024", "2024-25"
  startDate: text("start_date"),
  endDate: text("end_date"),
  
  // Competition structure
  totalMatches: integer("total_matches"),
  totalTeams: integer("total_teams"),
  venues: text("venues").array().default(sql`ARRAY[]::text[]`),
  
  // Competition statistics
  historicalStats: json("historical_stats").$type<{
    totalSeasons: number;
    avgMatchesPerSeason: number;
    mostSuccessfulTeam: string;
    recordScores: {
      highest: { score: number; team: string; match: string };
      lowest: { score: number; team: string; match: string };
    };
    avgRunRate: number;
    competitiveness_index: number; // How competitive the league is
  }>().default(sql`'{}'::json`),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIndex: index("competitions_name_idx").on(table.name),
  entitySportIdIndex: index("competitions_entity_sport_idx").on(table.entitySportId),
  sportCategoryIndex: index("competitions_sport_category_idx").on(table.sport, table.category),
}));

// Historical Match Results - Comprehensive completed match data
export const historicalMatches = pgTable("historical_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic match information
  entitySportId: text("entity_sport_id").unique(),
  matchName: text("match_name").notNull(),
  sport: text("sport").notNull(),
  format: text("format").notNull(), // "test", "odi", "t20"
  
  // Teams and venue
  team1Id: varchar("team1_id").notNull().references(() => teams.id),
  team2Id: varchar("team2_id").notNull().references(() => teams.id),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  competitionId: varchar("competition_id").notNull().references(() => competitions.id),
  
  // Match timing
  matchDate: timestamp("match_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  matchDuration: integer("match_duration"), // Minutes
  
  // Match result
  result: text("result").notNull(), // "team1_won", "team2_won", "draw", "tie", "no_result"
  winningTeamId: varchar("winning_team_id").references(() => teams.id),
  winMargin: json("win_margin").$type<{
    type: "runs" | "wickets" | "innings" | "draw";
    value?: number;
    description: string;
  }>().notNull(),
  
  // Toss information
  tossWinnerId: varchar("toss_winner_id").references(() => teams.id),
  tossDecision: text("toss_decision"), // "bat", "field"
  
  // Detailed match statistics
  matchStats: json("match_stats").$type<{
    // Team scores by innings
    team1Innings: Array<{
      innings: number;
      runs: number;
      wickets: number;
      overs: number;
      runRate: number;
      extras: number;
      allOut: boolean;
    }>;
    team2Innings: Array<{
      innings: number;
      runs: number;
      wickets: number;
      overs: number;
      runRate: number;
      extras: number;
      allOut: boolean;
    }>;
    
    // Match aggregates
    totalRuns: number;
    totalWickets: number;
    totalOvers: number;
    avgRunRate: number;
    
    // Partnership details
    highestPartnership: {
      runs: number;
      wicket: number;
      team: string;
      players: string[];
    };
    
    // Match context
    duckworth_lewis_applied: boolean;
    super_over: boolean;
    match_type: "day" | "day_night" | "night";
  }>().notNull().default(sql`'{}'::json`),
  
  // Player performances in this match
  playerPerformances: json("player_performances").$type<Array<{
    playerId: string;
    playerName: string;
    team: string;
    
    // Batting performance
    batting: {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      strikeRate: number;
      dismissal: string;
      position: number;
    };
    
    // Bowling performance
    bowling: {
      overs: number;
      maidens: number;
      runs: number;
      wickets: number;
      economy: number;
      wides: number;
      noBalls: number;
    };
    
    // Fielding performance
    fielding: {
      catches: number;
      runOuts: number;
      stumpings: number;
    };
  }>>().notNull().default(sql`'[]'::json`),
  
  // Weather conditions during match
  weatherConditions: json("weather_conditions").$type<{
    temperature: number;
    humidity: number;
    windSpeed: number;
    conditions: string;
    rainDelays: Array<{
      start: string;
      end: string;
      duration: number;
    }>;
    overallImpact: "significant" | "moderate" | "minimal" | "none";
  }>().default(sql`'{}'::json`),
  
  // Match significance and context
  matchContext: json("match_context").$type<{
    seriesStatus: string; // "1-0", "Level 0-0", etc.
    tournamentStage: string; // "Group", "Quarter-final", etc.
    importance: "low" | "medium" | "high" | "critical";
    recordsBroken: string[];
    milestones: string[];
  }>().default(sql`'{}'::json`),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  entitySportIdIndex: index("historical_matches_entity_sport_idx").on(table.entitySportId),
  team1IdIndex: index("historical_matches_team1_idx").on(table.team1Id),
  team2IdIndex: index("historical_matches_team2_idx").on(table.team2Id),
  venueIdIndex: index("historical_matches_venue_idx").on(table.venueId),
  competitionIdIndex: index("historical_matches_competition_idx").on(table.competitionId),
  matchDateIndex: index("historical_matches_date_idx").on(table.matchDate),
  resultIndex: index("historical_matches_result_idx").on(table.result),
}));

// Historical Team Performance - Team statistics over time
export const historicalTeamPerformance = pgTable("historical_team_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id),
  
  // Time period for this performance record
  periodType: text("period_type").notNull(), // "season", "year", "competition", "overall"
  periodValue: text("period_value").notNull(), // "2024", "2024-25", "ipl-2024"
  format: text("format").notNull(), // "test", "odi", "t20"
  
  // Basic performance metrics
  matchesPlayed: integer("matches_played").notNull().default(0),
  matchesWon: integer("matches_won").notNull().default(0),
  matchesLost: integer("matches_lost").notNull().default(0),
  matchesDrawn: integer("matches_drawn").notNull().default(0),
  matchesTied: integer("matches_tied").notNull().default(0),
  noResults: integer("no_results").notNull().default(0),
  
  // Win/loss ratios
  winPercentage: real("win_percentage").notNull().default(0),
  winLossRatio: real("win_loss_ratio").notNull().default(0),
  
  // Batting statistics
  battingStats: json("batting_stats").$type<{
    totalRuns: number;
    totalInnings: number;
    average: number;
    runRate: number;
    highestScore: number;
    lowestScore: number;
    totalFours: number;
    totalSixes: number;
    centuries: number;
    halfCenturies: number;
    ducks: number;
    
    // Situational batting
    powerplayRuns: number;
    powerplayAvg: number;
    deathOverRuns: number;
    deathOverAvg: number;
    
    // Performance context
    homeAverage: number;
    awayAverage: number;
    neutralAverage: number;
    chasingAverage: number;
    defendingAverage: number;
  }>().notNull().default(sql`'{}'::json`),
  
  // Bowling statistics
  bowlingStats: json("bowling_stats").$type<{
    totalWickets: number;
    totalOvers: number;
    totalRuns: number;
    average: number;
    economy: number;
    strikeRate: number;
    bestBowling: string;
    fiveWickets: number;
    tenWickets: number;
    
    // Bowling breakdown
    totalMaidens: number;
    dotBallPercentage: number;
    boundariesConceded: number;
    
    // Situational bowling
    powerplayWickets: number;
    powerplayEconomy: number;
    deathOverWickets: number;
    deathOverEconomy: number;
    
    // Performance context
    homeAverage: number;
    awayAverage: number;
    neutralAverage: number;
  }>().notNull().default(sql`'{}'::json`),
  
  // Head-to-head records
  headToHeadRecords: json("head_to_head_records").$type<Record<string, {
    matches: number;
    wins: number;
    losses: number;
    draws: number;
    winPercentage: number;
    lastMeeting: string;
  }>>().notNull().default(sql`'{}'::json`),
  
  // Form and trends
  currentForm: json("current_form").$type<{
    last5Matches: Array<"W" | "L" | "D" | "T" | "NR">;
    last10Matches: Array<"W" | "L" | "D" | "T" | "NR">;
    formTrend: "improving" | "declining" | "stable";
    consistency: number; // 0-1 scale
  }>().notNull().default(sql`'{}'::json`),
  
  // Ranking and ratings
  rankings: json("rankings").$type<{
    iccRanking?: number;
    eloRating: number;
    powerIndex: number; // Custom team strength index
    formRating: number;
  }>().notNull().default(sql`'{}'::json`),
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIndex: index("historical_team_performance_team_idx").on(table.teamId),
  periodIndex: index("historical_team_performance_period_idx").on(table.periodType, table.periodValue),
  formatIndex: index("historical_team_performance_format_idx").on(table.format),
  uniqueTeamPeriod: unique().on(table.teamId, table.periodType, table.periodValue, table.format),
}));

// Betting Odds Data Storage
export const oddsData = pgTable("odds_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  eventId: text("event_id"), // External API event ID
  sportKey: text("sport_key").notNull(), // 'cricket_test_match', 'cricket_one_day_int', 'cricket_t20_int'
  eventName: text("event_name").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  commenceTime: timestamp("commence_time").notNull(),
  // Market consensus analysis
  marketConsensus: json("market_consensus").$type<{
    team1Name: string;
    team2Name: string;
    team1WinProbability: number;
    team2WinProbability: number;
    drawProbability?: number;
    bookmakerCount: number;
    oddsVariance: number;
    sharpBookmakers: string[];
    publicBookmakers: string[];
    bestTeam1Odds: { bookmaker: string; odds: number };
    bestTeam2Odds: { bookmaker: string; odds: number };
    bestDrawOdds?: { bookmaker: string; odds: number };
    marketEfficiency: 'efficient' | 'moderate' | 'inefficient';
    marketBias?: 'team1' | 'team2' | 'neutral';
    consensusSummary: string;
  }>().default(sql`'{}'::json`),
  // Individual bookmaker odds
  bookmakerOdds: json("bookmaker_odds").$type<Array<{
    bookmaker: {
      key: string;
      title: string;
      lastUpdate: string;
    };
    markets: Array<{
      key: string; // 'h2h', 'spreads', 'totals'
      lastUpdate: string;
      outcomes: Array<{
        name: string;
        price: number;
        impliedProbability: number;
      }>;
    }>;
  }>>().default(sql`'[]'::json`),
  // Analysis results
  oddsAnalysis: json("odds_analysis").$type<{
    formatType: 'test' | 'odi' | 't20';
    marketMaturity: 'early' | 'mature' | 'closing';
    liquidityLevel: 'high' | 'medium' | 'low';
    marketPredictedWinner: string;
    confidenceLevel: number;
    valueBets: Array<{
      team: string;
      bookmaker: string;
      odds: number;
      estimatedEdge: number;
    }>;
    modelAlignmentScore?: number;
    marketVsModel?: {
      team1OddsEdge: number;
      team2OddsEdge: number;
      suggestedBet?: 'team1' | 'team2' | 'none';
    };
  }>().default(sql`'{}'::json`),
  dataSource: text("data_source").notNull().default("the_odds_api"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fixtureIdIndex: index("odds_data_fixture_idx").on(table.fixtureId),
  eventIdIndex: index("odds_data_event_idx").on(table.eventId),
  sportKeyIndex: index("odds_data_sport_idx").on(table.sportKey),
  commenceTimeIndex: index("odds_data_commence_idx").on(table.commenceTime),
  uniqueOddsData: unique().on(table.fixtureId, table.fetchedAt), // One record per fixture per fetch
}));

// Enhanced Predictions with Weather and Odds Integration
export const enhancedPredictions = pgTable("enhanced_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fixtureId: varchar("fixture_id").notNull().references(() => fixtures.id),
  weatherDataId: varchar("weather_data_id").references(() => weatherData.id),
  oddsDataId: varchar("odds_data_id").references(() => oddsData.id),
  modelVersion: text("model_version").notNull().default("v2.0_weather_odds"),
  
  // Base predictions (from existing Elo system)
  baseTeam1WinProb: real("base_team1_win_prob").notNull(),
  baseTeam2WinProb: real("base_team2_win_prob").notNull(),
  baseDrawProb: real("base_draw_prob"),
  
  // Enhanced predictions with all factors
  enhancedTeam1WinProb: real("enhanced_team1_win_prob").notNull(),
  enhancedTeam2WinProb: real("enhanced_team2_win_prob").notNull(),
  enhancedDrawProb: real("enhanced_draw_prob"),
  
  // Factor breakdowns
  weatherFactors: json("weather_factors").$type<{
    swingBowlingAdvantage: number;
    spinBowlingAdvantage: number;
    battingConditions: number;
    fieldingConditions: number;
    rainDelayRisk: number;
    pitchDegradation: number;
    overallBowlingAdvantage: number;
    weatherSummary: string;
  }>().default(sql`'{}'::json`),
  
  marketIntelligence: json("market_intelligence").$type<{
    marketConsensusTeam1: number;
    marketConsensusTeam2: number;
    marketConfidence: number;
    marketBias?: 'team1' | 'team2' | 'neutral';
    valueBettingOpportunities: Array<{
      team: string;
      modelEdge: number;
      recommendation: 'strong_bet' | 'value_bet' | 'avoid';
    }>;
    bookmakerCount: number;
    marketEfficiency: 'efficient' | 'moderate' | 'inefficient';
    sharpMoneyIndicator?: 'team1' | 'team2' | 'neutral';
  }>().default(sql`'{}'::json`),
  
  venueFactors: json("venue_factors").$type<{
    homeBias: number;
    pitchType: 'batting' | 'bowling' | 'balanced';
    boundaryDistance: 'short' | 'medium' | 'long';
    weatherPattern: 'stable' | 'variable' | 'extreme';
    altitudeEffect?: number;
  }>().default(sql`'{}'::json`),
  
  contextualFactors: json("contextual_factors").$type<{
    seriesStage: 'early' | 'middle' | 'decisive';
    teamRest: {
      team1DaysSinceLastMatch: number;
      team2DaysSinceLastMatch: number;
    };
    playerAvailability?: {
      team1KeyPlayersMissing: number;
      team2KeyPlayersMissing: number;
    };
    pressureLevel: 'low' | 'medium' | 'high';
  }>().default(sql`'{}'::json`),
  
  // Prediction metadata
  confidenceLevel: real("confidence_level").notNull(), // 0-1 scale
  predictionQuality: text("prediction_quality").notNull().default("medium"), // 'high' | 'medium' | 'low'
  
  // Recommendations
  recommendedBet: text("recommended_bet"), // 'team1' | 'team2' | 'draw' | 'no_bet'
  modelEdge: real("model_edge"), // Expected value percentage
  
  // Human-readable insights
  predictionSummary: text("prediction_summary").notNull(),
  keyInsights: json("key_insights").$type<string[]>().default(sql`'[]'::json`),
  
  // Result tracking
  actualResult: text("actual_result"), // "team1" | "team2" | "draw" (filled after match)
  accuracyScore: real("accuracy_score"), // Calculated after match completion
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fixtureIdIndex: index("enhanced_predictions_fixture_idx").on(table.fixtureId),
  modelVersionIndex: index("enhanced_predictions_version_idx").on(table.modelVersion),
  weatherDataIdIndex: index("enhanced_predictions_weather_idx").on(table.weatherDataId),
  oddsDataIdIndex: index("enhanced_predictions_odds_idx").on(table.oddsDataId),
  // Ensure unique enhanced predictions per fixture/model version
  uniqueEnhancedPrediction: unique().on(table.fixtureId, table.modelVersion),
  // Probability constraints
  baseTeam1ProbCheck: check("base_team1_prob_check", sql`${table.baseTeam1WinProb} >= 0 AND ${table.baseTeam1WinProb} <= 1`),
  baseTeam2ProbCheck: check("base_team2_prob_check", sql`${table.baseTeam2WinProb} >= 0 AND ${table.baseTeam2WinProb} <= 1`),
  enhancedTeam1ProbCheck: check("enhanced_team1_prob_check", sql`${table.enhancedTeam1WinProb} >= 0 AND ${table.enhancedTeam1WinProb} <= 1`),
  enhancedTeam2ProbCheck: check("enhanced_team2_prob_check", sql`${table.enhancedTeam2WinProb} >= 0 AND ${table.enhancedTeam2WinProb} <= 1`),
  confidenceCheck: check("confidence_check", sql`${table.confidenceLevel} >= 0 AND ${table.confidenceLevel} <= 1`),
  // Probability sum constraints
  baseProbSumCheck: check("base_prob_sum_check", sql`(${table.baseTeam1WinProb} + ${table.baseTeam2WinProb} + COALESCE(${table.baseDrawProb}, 0)) BETWEEN 0.99 AND 1.01`),
  enhancedProbSumCheck: check("enhanced_prob_sum_check", sql`(${table.enhancedTeam1WinProb} + ${table.enhancedTeam2WinProb} + COALESCE(${table.enhancedDrawProb}, 0)) BETWEEN 0.99 AND 1.01`),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFixtureSchema = createInsertSchema(fixtures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// AI Prediction Schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFixtureParticipantSchema = createInsertSchema(fixtureParticipants).omit({
  id: true,
  createdAt: true,
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  updatedAt: true,
});

export const insertRatingsHistorySchema = createInsertSchema(ratingsHistory).omit({
  id: true,
});

export const insertMatchStatisticsSchema = createInsertSchema(matchStatistics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({
  id: true,
  updatedAt: true,
});

export const insertPredictionFeaturesSchema = createInsertSchema(predictionFeatures).omit({
  id: true,
  generatedAt: true,
});

export const insertWeatherDataSchema = createInsertSchema(weatherData).omit({
  id: true,
  fetchedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOddsDataSchema = createInsertSchema(oddsData).omit({
  id: true,
  fetchedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnhancedPredictionSchema = createInsertSchema(enhancedPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamExternalIdSchema = createInsertSchema(teamExternalIds).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerExternalIdSchema = createInsertSchema(playerExternalIds).omit({
  id: true,
  createdAt: true,
});

// Historical Player Performance Timeline - Player statistics over time periods
export const historicalPlayerPerformance = pgTable("historical_player_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => players.id),
  
  // Time period for this performance record
  periodType: text("period_type").notNull(), // "season", "year", "competition", "month"
  periodValue: text("period_value").notNull(), // "2024", "2024-25", "ipl-2024", "2024-01"
  format: text("format").notNull(), // "test", "odi", "t20"
  
  // Match participation
  matchesPlayed: integer("matches_played").notNull().default(0),
  matchesWon: integer("matches_won").notNull().default(0),
  
  // Detailed performance metrics (same structure as player_stats but for specific periods)
  battingPerformance: json("batting_performance").$type<{
    innings: number;
    notOuts: number;
    runs: number;
    balls: number;
    average: number;
    strikeRate: number;
    hundreds: number;
    fifties: number;
    fours: number;
    sixes: number;
    highestScore: number;
    ducks: number;
    homeRuns: number;
    awayRuns: number;
    neutralRuns: number;
    chasingRuns: number;
    defendingRuns: number;
    powerplayRuns: number;
    deathOverRuns: number;
  }>().notNull().default(sql`'{}'::json`),
  
  bowlingPerformance: json("bowling_performance").$type<{
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
    average: number;
    strikeRate: number;
    bestBowling: string;
    fiveWickets: number;
    fourWickets: number;
    dotBalls: number;
    homeWickets: number;
    awayWickets: number;
    powerplayWickets: number;
    middleOverWickets: number;
    deathOverWickets: number;
  }>().notNull().default(sql`'{}'::json`),
  
  fieldingPerformance: json("fielding_performance").$type<{
    catches: number;
    runOuts: number;
    stumpings: number;
    droppedCatches: number;
    catchSuccessRate: number;
  }>().notNull().default(sql`'{}'::json`),
  
  // Performance ratings and trends
  performanceRating: real("performance_rating").notNull().default(0), // 0-10 scale
  consistencyRating: real("consistency_rating").notNull().default(0), // How consistent player was
  impactRating: real("impact_rating").notNull().default(0), // Match-winning contributions
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  playerIdIndex: index("historical_player_performance_player_idx").on(table.playerId),
  periodIndex: index("historical_player_performance_period_idx").on(table.periodType, table.periodValue),
  formatIndex: index("historical_player_performance_format_idx").on(table.format),
  uniquePlayerPeriod: unique().on(table.playerId, table.periodType, table.periodValue, table.format),
}));

// Historical Odds and Market Data
export const historicalOddsData = pgTable("historical_odds_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => historicalMatches.id),
  
  // EntitySport odds data
  entitySportEventId: text("entity_sport_event_id"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  
  // Pre-match odds
  preMatchOdds: json("pre_match_odds").$type<{
    team1Win: number;
    team2Win: number;
    draw?: number;
    tie?: number;
    team1Handicap?: Record<string, number>;
    team2Handicap?: Record<string, number>;
    totalRuns?: Record<string, number>;
    topBatsman?: Record<string, number>;
    topBowler?: Record<string, number>;
  }>().notNull().default(sql`'{}'::json`),
  
  // Closing odds (just before match)
  closingOdds: json("closing_odds").$type<{
    team1Win: number;
    team2Win: number;
    draw?: number;
    impliedProbability: {
      team1: number;
      team2: number;
      draw?: number;
    };
    marketEfficiency: number;
  }>().notNull().default(sql`'{}'::json`),
  
  // Live odds movement during match
  liveOddsMovement: json("live_odds_movement").$type<Array<{
    timestamp: string;
    team1Odds: number;
    team2Odds: number;
    matchSituation: string; // "0/0 (0.0)", "50/2 (8.3)", etc.
    significantMovement: boolean;
  }>>().default(sql`'[]'::json`),
  
  // Market analysis
  marketAnalysis: json("market_analysis").$type<{
    openingFavorite: "team1" | "team2";
    closingFavorite: "team1" | "team2";
    favoriteChanged: boolean;
    oddsMovement: "significant" | "moderate" | "minimal";
    marketSentiment: "confident" | "uncertain" | "mixed";
    valueOpportunities: string[];
    actualResult: "team1" | "team2" | "draw" | "tie" | "no_result";
    marketAccuracy: number; // How accurate the closing odds were
  }>().notNull().default(sql`'{}'::json`),
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  matchIdIndex: index("historical_odds_data_match_idx").on(table.matchId),
  recordedAtIndex: index("historical_odds_data_recorded_idx").on(table.recordedAt),
  entitySportEventIdIndex: index("historical_odds_data_entity_sport_idx").on(table.entitySportEventId),
}));

// Historical Weather Data for completed matches
export const historicalWeatherData = pgTable("historical_weather_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => historicalMatches.id),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  
  // Weather conditions during the match
  matchWeather: json("match_weather").$type<{
    startConditions: {
      temperature: number;
      humidity: number;
      windSpeed: number;
      windDirection: number;
      pressure: number;
      cloudCover: number;
      conditions: string;
    };
    weatherChanges: Array<{
      time: string; // "Day 1, Session 2" or "Over 15"
      temperature: number;
      humidity: number;
      windSpeed: number;
      conditions: string;
      impact: "significant" | "moderate" | "minimal";
    }>;
    rainDelays: Array<{
      startTime: string;
      endTime: string;
      duration: number; // minutes
      impactOnPitch: "significant" | "moderate" | "minimal";
    }>;
    overallConditions: "excellent" | "good" | "fair" | "poor" | "severely_affected";
    weatherImpactOnResult: "none" | "minimal" | "moderate" | "significant";
  }>().notNull().default(sql`'{}'::json`),
  
  // Cricket-specific weather impact analysis
  cricketImpact: json("cricket_impact").$type<{
    battingConditions: "excellent" | "good" | "fair" | "difficult" | "very_difficult";
    bowlingConditions: "excellent" | "good" | "fair" | "difficult" | "very_difficult";
    fieldingConditions: "excellent" | "good" | "fair" | "difficult" | "very_difficult";
    
    swingBowlingFactor: number; // 0-1 scale
    spinBowlingFactor: number; // 0-1 scale
    paceBowlingFactor: number; // 0-1 scale
    
    pitchCondition: "hard_dry" | "firm" | "good" | "slightly_damp" | "damp" | "wet";
    outfieldCondition: "fast" | "medium" | "slow" | "very_slow";
    
    overallAdvantage: "heavily_batsman" | "batsman" | "neutral" | "bowler" | "heavily_bowler";
    
    typicalConditionsForVenue: boolean; // Was this typical weather for this venue?
    seasonalVariation: "above_average" | "average" | "below_average";
  }>().notNull().default(sql`'{}'::json`),
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  matchIdIndex: index("historical_weather_data_match_idx").on(table.matchId),
  venueIdIndex: index("historical_weather_data_venue_idx").on(table.venueId),
}));

// Entity Sport API Call Tracking
export const entitySportApiCalls = pgTable("entity_sport_api_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  endpoint: text("endpoint").notNull(),
  requestParams: json("request_params").$type<Record<string, any>>().notNull().default(sql`'{}'::json`),
  responseStatus: integer("response_status").notNull(),
  
  recordsReturned: integer("records_returned").default(0),
  newRecordsAdded: integer("new_records_added").default(0),
  existingRecordsUpdated: integer("existing_records_updated").default(0),
  
  responseTime: integer("response_time"),
  rateLimitRemaining: integer("rate_limit_remaining"),
  
  errorMessage: text("error_message"),
  errorType: text("error_type"),
  
  ingestionResults: json("ingestion_results").$type<{
    tablesAffected: string[];
    processingTime: number;
    success: boolean;
    warnings: string[];
    errors: string[];
  }>().default(sql`'{}'::json`),
  
  callTimestamp: timestamp("call_timestamp").defaultNow(),
}, (table) => ({
  endpointIndex: index("entity_sport_api_calls_endpoint_idx").on(table.endpoint),
  timestampIndex: index("entity_sport_api_calls_timestamp_idx").on(table.callTimestamp),
  statusIndex: index("entity_sport_api_calls_status_idx").on(table.responseStatus),
}));

// Insert schemas for new historical tables
export const insertVenueSchema = createInsertSchema(venues).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompetitionSchema = createInsertSchema(competitions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHistoricalMatchSchema = createInsertSchema(historicalMatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHistoricalTeamPerformanceSchema = createInsertSchema(historicalTeamPerformance).omit({ id: true, updatedAt: true });
export const insertHistoricalPlayerPerformanceSchema = createInsertSchema(historicalPlayerPerformance).omit({ id: true, updatedAt: true });
export const insertHistoricalOddsDataSchema = createInsertSchema(historicalOddsData).omit({ id: true, updatedAt: true });
export const insertHistoricalWeatherDataSchema = createInsertSchema(historicalWeatherData).omit({ id: true, updatedAt: true });
export const insertEntitySportApiCallSchema = createInsertSchema(entitySportApiCalls).omit({ id: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertFixture = z.infer<typeof insertFixtureSchema>;
export type Fixture = typeof fixtures.$inferSelect;

export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type BotSettings = typeof botSettings.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// AI Prediction Types
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export type InsertFixtureParticipant = z.infer<typeof insertFixtureParticipantSchema>;
export type FixtureParticipant = typeof fixtureParticipants.$inferSelect;

export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;

export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

export type InsertRatingsHistory = z.infer<typeof insertRatingsHistorySchema>;
export type RatingsHistory = typeof ratingsHistory.$inferSelect;

export type InsertMatchStatistics = z.infer<typeof insertMatchStatisticsSchema>;
export type MatchStatistics = typeof matchStatistics.$inferSelect;

export type InsertPlayerStats = z.infer<typeof insertPlayerStatsSchema>;
export type PlayerStats = typeof playerStats.$inferSelect;

export type InsertPredictionFeatures = z.infer<typeof insertPredictionFeaturesSchema>;
export type PredictionFeatures = typeof predictionFeatures.$inferSelect;

export type InsertTeamExternalId = z.infer<typeof insertTeamExternalIdSchema>;
export type TeamExternalId = typeof teamExternalIds.$inferSelect;

export type InsertPlayerExternalId = z.infer<typeof insertPlayerExternalIdSchema>;
export type PlayerExternalId = typeof playerExternalIds.$inferSelect;

// Weather and Odds Types
export type InsertWeatherData = z.infer<typeof insertWeatherDataSchema>;
export type WeatherData = typeof weatherData.$inferSelect;

export type InsertOddsData = z.infer<typeof insertOddsDataSchema>;
export type OddsData = typeof oddsData.$inferSelect;

export type InsertEnhancedPrediction = z.infer<typeof insertEnhancedPredictionSchema>;
export type EnhancedPrediction = typeof enhancedPredictions.$inferSelect;

// Historical Data Types
export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type Venue = typeof venues.$inferSelect;

export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = typeof competitions.$inferSelect;

export type InsertHistoricalMatch = z.infer<typeof insertHistoricalMatchSchema>;
export type HistoricalMatch = typeof historicalMatches.$inferSelect;

export type InsertHistoricalTeamPerformance = z.infer<typeof insertHistoricalTeamPerformanceSchema>;
export type HistoricalTeamPerformance = typeof historicalTeamPerformance.$inferSelect;

export type InsertHistoricalPlayerPerformance = z.infer<typeof insertHistoricalPlayerPerformanceSchema>;
export type HistoricalPlayerPerformance = typeof historicalPlayerPerformance.$inferSelect;

export type InsertHistoricalOddsData = z.infer<typeof insertHistoricalOddsDataSchema>;
export type HistoricalOddsData = typeof historicalOddsData.$inferSelect;

export type InsertHistoricalWeatherData = z.infer<typeof insertHistoricalWeatherDataSchema>;
export type HistoricalWeatherData = typeof historicalWeatherData.$inferSelect;

export type InsertEntitySportApiCall = z.infer<typeof insertEntitySportApiCallSchema>;
export type EntitySportApiCall = typeof entitySportApiCalls.$inferSelect;
