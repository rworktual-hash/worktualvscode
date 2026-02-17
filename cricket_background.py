import pygame

WHITE = (255, 255, 255)

# --- Functions ---
def stumps(screen, pitch_x, pitch_y, pitch_width, pitch_height):
    """Draws the stumps at the top and bottom of the pitch."""
    stump_width = 5
    stump_height = 25
    stump_gap = 8

    # Center of the pitch horizontally
    center_x = pitch_x + (pitch_width // 2)

    # Y positions for the top and bottom sets of stumps
    stump_set_y1 = pitch_y + 40
    stump_set_y2 = pitch_y + pitch_height - 40 - stump_height

    # Helper function to draw a single set of stumps at a given y-position
    def draw_one_set(y_pos):
        # Middle stump (centered on center_x)
        middle_stump_x = center_x - (stump_width // 2)
        pygame.draw.rect(screen, WHITE, (middle_stump_x, y_pos, stump_width, stump_height))
        
        # Left stump
        left_stump_x = middle_stump_x - stump_gap - stump_width
        pygame.draw.rect(screen, WHITE, (left_stump_x, y_pos, stump_width, stump_height))
        
        # Right stump
        right_stump_x = middle_stump_x + stump_width + stump_gap
        pygame.draw.rect(screen, WHITE, (right_stump_x, y_pos, stump_width, stump_height))

    # Draw both sets
    draw_one_set(stump_set_y1)
    draw_one_set(stump_set_y2)

