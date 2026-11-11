// Library store on Cloudflare D1 (see shared/library.js for the contract) plus users and sessions.
const metaOf = (r) => ({ id:r.id, folderId:r.folder_id || null, name:r.name, domain:r.domain, createdAt:r.created_at, updatedAt:r.updated_at });

export function d1Store(db){
  return {
    async listFolders(uid){
      const { results } = await db.prepare('SELECT id,name,created_at FROM folders WHERE user_id=? ORDER BY created_at').bind(uid).all();
      return results.map(r=>({ id:r.id, name:r.name, createdAt:r.created_at }));
    },
    async createFolder(uid,f){ await db.prepare('INSERT INTO folders (id,user_id,name,created_at) VALUES (?,?,?,?)').bind(f.id,uid,f.name,f.createdAt).run(); },
    async updateFolder(uid,id,p){ await db.prepare('UPDATE folders SET name=? WHERE id=? AND user_id=?').bind(p.name,id,uid).run(); },
    async deleteFolder(uid,id){
      await db.batch([
        db.prepare('DELETE FROM cascades WHERE folder_id=? AND user_id=?').bind(id,uid),
        db.prepare('DELETE FROM folders WHERE id=? AND user_id=?').bind(id,uid)
      ]);
    },
    async listCascades(uid){
      const { results } = await db.prepare('SELECT id,folder_id,name,domain,created_at,updated_at FROM cascades WHERE user_id=? ORDER BY updated_at DESC').bind(uid).all();
      return results.map(metaOf);
    },
    async getCascade(uid,id){
      const r = await db.prepare('SELECT * FROM cascades WHERE id=? AND user_id=?').bind(id,uid).first();
      return r ? { ...metaOf(r), data:JSON.parse(r.data) } : null;
    },
    async putCascade(uid,r){
      await db.prepare(`INSERT INTO cascades (id,user_id,folder_id,name,domain,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET folder_id=excluded.folder_id, name=excluded.name, domain=excluded.domain, data=excluded.data, updated_at=excluded.updated_at
        WHERE cascades.user_id=excluded.user_id`)
        .bind(r.id,uid,r.folderId,r.name,r.domain,JSON.stringify(r.data),r.createdAt,r.updatedAt).run();
    },
    async deleteCascade(uid,id){ await db.prepare('DELETE FROM cascades WHERE id=? AND user_id=?').bind(id,uid).run(); },

    // AI keys (encrypted by ai.js before they get here)
    async getAi(uid){
      const a = await db.prepare('SELECT active FROM ai_settings WHERE user_id=?').bind(uid).first();
      const { results } = await db.prepare('SELECT provider,key_enc,key_hint,model,base_url FROM ai_connections WHERE user_id=?').bind(uid).all();
      return { active:a ? a.active : 'demo', rows:results };
    },
    async setActive(uid,name,now){
      await db.prepare('INSERT INTO ai_settings (user_id,active) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active').bind(uid,name).run();
    },
    async putConn(uid,provider,c,now){
      await db.prepare(`INSERT INTO ai_connections (user_id,provider,key_enc,key_hint,model,base_url,updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(user_id,provider) DO UPDATE SET key_enc=excluded.key_enc, key_hint=excluded.key_hint, model=excluded.model, base_url=excluded.base_url, updated_at=excluded.updated_at`)
        .bind(uid,provider,c.keyEnc,c.hint,c.model,c.baseUrl,now).run();
    },

    // accounts
    async upsertUser(u,id,now){
      await db.prepare(`INSERT INTO users (id,google_sub,email,name,picture,created_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name, picture=excluded.picture`).bind(id,u.sub,u.email,u.name,u.picture,now).run();
      return db.prepare('SELECT id,email,name,picture FROM users WHERE google_sub=?').bind(u.sub).first();
    },
    async createSession(userId,tokenHash,expiresAt,now){
      await db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now).run();   // tidy up as we go
      await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(tokenHash,userId,expiresAt).run();
    },
    async userForSession(tokenHash,now){
      return db.prepare(`SELECT u.id,u.email,u.name,u.picture FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash,now).first();
    },
    async deleteSession(tokenHash){ await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run(); },
    async deleteUser(userId){ await db.batch([
      db.prepare('DELETE FROM ai_connections WHERE user_id=?').bind(userId), db.prepare('DELETE FROM ai_settings WHERE user_id=?').bind(userId),
      db.prepare('DELETE FROM cascades WHERE user_id=?').bind(userId), db.prepare('DELETE FROM folders WHERE user_id=?').bind(userId),
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId), db.prepare('DELETE FROM users WHERE id=?').bind(userId)
    ]); }
  };
}
