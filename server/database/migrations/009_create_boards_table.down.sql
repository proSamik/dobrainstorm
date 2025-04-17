-- Drop trigger first
DROP TRIGGER IF EXISTS trg_boards_updated_at ON boards;

-- Drop function 
DROP FUNCTION IF EXISTS update_boards_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_boards_user_id;
DROP INDEX IF EXISTS idx_boards_created_at;

-- Drop table
DROP TABLE IF EXISTS boards; 