# Dodgeball Masters - Proof of Concept

**Game Title:** Dodgeball Masters
**Language:** English
**Genre:** Multiplayer Competitive PvP

---

## Table of Contents

- [1. Concept Overview](#1-concept-overview)
- [2. Game Rules](#2-game-rules)
- [3. Core Mechanics](#3-core-mechanics)
- [4. Sound Effects](#4-sound-effects)
- [5. User Interface](#5-user-interface)
- [6. Progression & Ranking](#6-progression--ranking)
- [7. Game Modes](#7-game-modes)
- [8. Technical Architecture](#8-technical-architecture)
- [9. API Backend Integration](#9-api-backend-integration)
- [10. Proof of Concept Priorities](#10-proof-of-concept-priorities)

---

## 1. Concept Overview

**Dodgeball Masters** is a competitive online multiplayer game where two teams face off in arena-based matches. Players must dodge and deflect a tracking missile while working together to eliminate the opposing team.

### Game Type
- **Multiplayer Competitive Online (PvP)**
- **Team-based elimination matches**
- **Arena combat**

### Game Modes
- **Ranked Match** - Competitive ELO-based matchmaking
- **Unranked Match** - Casual quick play
- **Training Mode** - Practice vs AI bot

---

## 2. Game Rules

### Match Structure
- **Teams:** 2 teams competing (supports 1v1, 2v2, 3v3, or 5v5)
- **Objective:** Eliminate all players on the opposing team to win a round
- **Match Length:** 10 rounds per match (first to win 10 rounds wins the match)
- **Draw Condition:** If both teams are eliminated simultaneously, the round is a draw

### Win Conditions
- Team that completely eliminates the opposing team wins the round
- Team with most round wins after 10 rounds wins the match

---

## 3. Core Mechanics

### Missile System

#### Spawning
- Missile spawns at the **center of the arena**, slightly elevated
- Spawns at the beginning of each round

#### Initial Targeting
- One random player is designated as the **missile target**
- Target receives **visual and audio notification**

#### Speed Mechanics
- **Base Speed:** Slower than player movement speed
- **Speed Scaling:** +30% speed increase with each deflection
- Speed compounds multiplicatively (1.0x → 1.3x → 1.69x → 2.197x...)

#### Tracking Behavior
- Missile tracks the current target but **not in a perfectly linear path**
- **Orbital Evasion:** Players can evade by running in circles around the missile ("orbiting")
- Tracking becomes more aggressive as speed increases after deflections

#### Physical Properties
- **Size:** Similar to a human arm (rocket-sized)
- **Visual:** Sphere or rocket-style projectile

#### Damage System
- **Base Damage:** 75 HP
- **Damage Scaling:** Increases proportionally with missile speed
- Damage Formula: `Base Damage × (Current Speed / Base Speed)`

### Deflection System

#### Deflection Range
- **Range:** 5 meters in front of the player
- **Cone:** Forward-facing deflection zone

#### Deflection Rules
- Any player can deflect the missile when it enters their deflection zone
- Upon deflection, missile **redirects to the furthest enemy player** on the opposing team
- **All teammates** of the current target can deflect to protect them
- Each deflection increases missile speed by 30%

#### Team Strategy
- Coordination is key: teammates must position themselves to deflect for targeted players
- Risk vs reward: faster missiles deal more damage but are harder to deflect

### Health & Elimination

- **Max Health:** 100 HP per player
- **Damage Source:** Missile explosion on impact
- **Elimination:** Player dies when HP ≤ 0
- **Round End:** When all players of one team are eliminated

---

## 4. Sound Effects

### Connection & Lobby
- Server connection established
- Lobby/match found notification

### Match Flow
- Countdown before round start (3... 2... 1... GO!)
- Round end sound
- Match end sound

### Gameplay
- **Target Notification:** Played only for the player designated as missile target
- Deflection sound effect
- Missile impact/explosion sound
- Player elimination sound

---

## 5. User Interface

### Main Menu
- **Play** - Select game mode (Ranked, Unranked, Training)
- **Player Profile** - View stats and rank
- **Options** - Audio, video, controls (language locked to English)
- **Quit** - Exit game

### In-Game HUD
- **Player HP Bar** - Current health display
- **Team Score** - Rounds won by each team
- **Current Round Counter** - (e.g., "Round 3/10")
- **Round Timer** (if applicable)
- **Target Indicator** - Shows who is being targeted by missile

### Scoreboard (Tab Key)
Displays during and after matches:
- **Current Rank** (Bronze, Silver, Gold, etc.)
- **Player Name**
- **Kills / Deaths / Assists (K/D/A)**
- **Team Score**

### Player Profile Screen
- **Rank Badge & ELO Rating**
- **Global Statistics:**
  - Total Kills / Deaths / Assists
  - K/D Ratio
  - Matches Played
  - Win Rate %
  - Total Playtime
- **Cosmetics Section** (placeholder for future content)

---

## 6. Progression & Ranking

### ELO System

#### Rank Tiers
Each tier is separated by **100 ELO points**:

| Rank | ELO Range |
|------|-----------|
| **Bronze** | 500 - 599 |
| **Silver** | 600 - 699 |
| **Gold** | 700 - 799 |
| **Platinum** | 800 - 899 |
| **Diamond** | 900 - 999 |
| **Master** | 1000 - 1099 |
| **Grand Master** | 1100+ |
| **Top 500** | Top 500 players worldwide (above Grand Master) |

#### ELO Gain/Loss
- **Balanced Match** (equal average ELO): ±10 ELO
- **Unbalanced Matches:**
  - Win against lower-ranked team = fewer points gained
  - Win against higher-ranked team = more points gained
  - Loss against lower-ranked team = more points lost
  - Loss against higher-ranked team = fewer points lost

#### Starting Rank
- New players start at **1000 ELO (Master tier)**

---

## 7. Game Modes

### Ranked Match
- Competitive matchmaking based on ELO
- Affects player rank and rating
- Stricter matchmaking (similar skill levels)

### Unranked Match
- Casual quick play
- No ELO changes
- Faster matchmaking (looser skill restrictions)

### Training Mode
- **Solo practice mode**
- Player vs **AI Bot**
- **Bot Behavior:**
  - Bot is stationary
  - Bot **never misses deflections** (perfect deflection)
  - Purpose: Allows player to practice movement, orbital evasion, and deflection timing

---

## 8. Technical Architecture

### Multiplayer Framework
- **Server Type:** Dedicated server architecture
- **Network Model:** Server-authoritative gameplay

### Core Systems
- **Match Management:** Round-based game state
- **Team System:** Auto-balancing team assignment
- **Player State Replication:** Health, stats, rank synced across clients
- **Missile Physics:** Custom tracking and deflection system with networked projectile movement

### Matchmaking
- **ELO-based matchmaking** for ranked mode
- **Quick match** for unranked mode
- Backend API integration for player queuing

---

## 9. API Backend Integration

### Separate Backend Project
A **RESTful API backend** will be developed as a separate project to handle:

### API Endpoints (Planned)

#### Player Data
- `GET /api/player/{id}` - Retrieve player profile
- `POST /api/player/register` - Create new player account
- `PUT /api/player/{id}` - Update player data

#### Ranking & Stats
- `GET /api/player/{id}/rank` - Get player rank and ELO
- `PUT /api/player/{id}/elo` - Update ELO after match
- `GET /api/leaderboard` - Get Top 500 leaderboard

#### Matchmaking
- `POST /api/matchmaking/queue` - Enter matchmaking queue
- `DELETE /api/matchmaking/queue/{id}` - Leave queue
- `GET /api/matchmaking/status` - Check queue status

#### Match Results
- `POST /api/match/result` - Submit match outcome
- `GET /api/match/history/{playerId}` - Get match history

### Data Synchronized
- Player Account (username, authentication)
- Rank & ELO rating
- Match statistics (K/D/A, win rate, matches played)
- Configuration settings (future: cosmetics, loadouts)

---

## 10. Proof of Concept Priorities

### Phase 1: Core Gameplay
✓ Simple arena map (closed, symmetrical)
✓ Missile system (tracking, orbiting, deflection, speed scaling)
✓ Health, damage, and elimination mechanics
✓ Round-based match flow (10 rounds)

### Phase 2: Multiplayer
- Server-client networking
- Player connection and session management
- Server-authoritative gameplay replication

### Phase 3: Backend Integration
- Minimal API for ELO storage/retrieval
- Player authentication
- Match result reporting

### Phase 4: UI Implementation
- Main menu system
- In-game HUD (HP, score, round counter)
- Scoreboard display
- Player profile screen

### Phase 5: Audio
- Sound effect integration for all key events
- Audio feedback for targeting, deflection, elimination

### Phase 6: AI & Training
- Basic bot with perfect deflection AI
- Training mode implementation

---

## Development Notes

### Current Status
**In Development** - Core C++ classes created:
- `ADBMGameMode` - Match and round management
- `ADBMGameState` - Replicated game state
- `ADBMPlayerState` - Player stats, health, rank
- `ADBMCharacter` - Player character with Enhanced Input
- `ADBMMissile` - Missile actor with tracking and deflection

### Next Steps
1. Compile and test core classes
2. Create Blueprint child classes for visual configuration
3. Build basic arena map
4. Implement Enhanced Input assets
5. Set up multiplayer testing environment
6. Create UI widgets for HUD and menus

---

## Credits

**Project:** Dodgeball Masters
**Development:** Proof of Concept Phase

---

For questions or issues, refer to project documentation or contact the development team.