# Image Prompt Battle App - Requirements Document

## Overview
A real-time multiplayer prompt battle application where two users compete to write the best image generation prompts based on a given target, with a central display for audience engagement and judging.

## System Architecture

### Three-Screen Setup
1. **Player 1 Screen** - Individual contestant interface
2. **Player 2 Screen** - Individual contestant interface  
3. **Central Display Screen** - Audience/judge interface (connected to projector)

### Core Components
- **Frontend Applications** (3 separate interfaces)
- **Backend Server** (real-time coordination)
- **Image Generation API Integration** (OpenAI DALL-E or similar)
- **Real-time Communication** (WebSocket connections)

## Functional Requirements

### Game Flow
1. **Setup Phase**
   - Admin sets battle parameters (timer duration, target prompt/image)
   - Players connect to their respective screens
   - Central display shows "waiting for players" status

2. **Battle Preparation**
   - Central display shows both players as "ready"
   - Target is revealed simultaneously on all screens
   - Countdown timer (3-2-1) before prompt writing begins

3. **Prompt Writing Phase**
   - Timer starts (configurable: 30s, 60s, 90s, 120s)
   - Players write prompts on their individual screens
   - Central display shows:
     - Timer countdown
     - **Live prompt text from both players as they type** (real-time updates)
     - The target challenge
   - Players cannot see the projected central screen, so live typing is safe to show
   - Audience can watch prompts evolve in real-time

4. **Submission & Generation**
   - Automatic submission when timer expires
   - Both prompts sent to image generation API simultaneously
   - **Synchronized reveal**: First generated image is held until second completes
   - Loading state shows progress for both generations
   - Both images flash up simultaneously on central display for maximum drama

5. **Judging Phase**
   - Central display shows:
     - Target challenge
     - Both generated images
     - Player names/avatars
     - Winner selection interface
   - Crowd votes/judge decides winner
   - Fanfare animation and winner announcement

6. **Reset for Next Round**
   - Clear previous results
   - Return to setup phase

### Target Types
- **Text Prompt Recreation**: "Generate an image of a sunset over mountains"
- **Image Recreation**: Show reference image to recreate
- **Creative Challenge**: "Make the most creative interpretation of 'chaos'"
- **Style Challenge**: "Create something in the style of Van Gogh"

## Technical Requirements

### Player Interface Features
- **Prompt Input**: Large text area for writing prompts
- **Timer Display**: Prominent countdown timer
- **Target Display**: Clear presentation of the challenge
- **Connection Status**: Visual indicator of connection state
- **Character Counter**: Optional limit on prompt length

### Central Display Features
- **Live Prompt Display**: Real-time typing from both players during battle phase
- **Synchronized Image Reveal**: Hold faster generation until both complete
- **Dual Image Display**: Side-by-side generated images with dramatic simultaneous reveal
- **Battle Information**: Target, timer, player names
- **Winner Selection**: Click/touch interface to select winner
- **Victory Animation**: Celebratory effects for winner
- **Battle History**: Optional previous round results
- **Admin Controls**: Start/stop/reset battle functionality

### Backend Requirements
- **Real-time Synchronization**: All screens update simultaneously
- **Live Typing Relay**: Stream prompt text updates from players to central display
- **Generation Queue Management**: Hold completed images until both are ready
- **Timer Management**: Centralized countdown coordination
- **Prompt Collection**: Secure handling of user inputs
- **API Integration**: Reliable image generation requests with result synchronization
- **State Management**: Battle phases and transitions
- **Error Handling**: Graceful failures and recovery

### Performance Requirements
- **Response Time**: < 2 seconds for state updates
- **Image Generation**: Handle API timeouts gracefully
- **Concurrent Users**: Support multiple simultaneous battles
- **Network Resilience**: Reconnection handling

## Technical Stack Recommendations

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS for rapid UI development
- **Real-time**: Socket.io client
- **Animations**: Framer Motion for victory effects

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.io server
- **Database**: Redis for session state (optional)

### Infrastructure
- **Deployment**: Can run locally or cloud-hosted
- **Image API**: OpenAI DALL-E 3 or Stability AI
- **WebSocket**: For real-time coordination

## API Integration

### Image Generation Service
```javascript
// Example API call structure
POST https://api.openai.com/v1/images/generations
{
  "model": "dall-e-3",
  "prompt": "[user_prompt]",
  "size": "1024x1024",
  "quality": "standard",
  "n": 1
}
```

### Error Handling
- API rate limits
- Generation failures
- Network timeouts
- Inappropriate content filtering

## User Experience Considerations

### Player Experience
- Clear instructions and visual feedback
- Prominent timer to create urgency
- Satisfying submission confirmation
- Clean, distraction-free interface

### Audience Experience
- Large, readable text and images on central display
- Dramatic reveal of generated images
- Clear winner selection process
- Engaging victory celebrations

### Admin Experience
- Easy battle setup and management
- Quick target configuration
- Emergency stop/reset capabilities
- Battle history and statistics

## Security & Content Considerations
- **Prompt Filtering**: Basic inappropriate content detection
- **Rate Limiting**: Prevent API abuse
- **Input Sanitization**: Clean user prompts
- **Content Moderation**: Handle NSFW generated images

## Future Enhancements
- **Tournament Mode**: Multi-round elimination
- **Spectator Voting**: Audience participation via phones
- **Prompt History**: Save and replay interesting battles
- **AI Judging**: Automated winner selection based on criteria
- **Team Battles**: 2v2 collaborative prompting
- **Themed Competitions**: Specific art styles or subjects

## Success Metrics
- Battle completion rate
- Image generation success rate
- User engagement time
- Audience participation level
- Technical reliability (uptime, errors)

---

This document provides the foundation for building an engaging, reliable prompt battle application that will create memorable experiences for both contestants and audiences.