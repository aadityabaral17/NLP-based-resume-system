describe('mailer transport selection', () => {
  const saved = { ...process.env };

  const load = (env) => {
    jest.resetModules();
    for (const k of ['BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_USER', 'SMTP_PASS']) {
      delete process.env[k];
    }
    Object.assign(process.env, env);
    return require('./mailer');
  };

  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('reports "none" when nothing is configured', () => {
    expect(load({}).transportName()).toBe('none');
  });

  it('uses SMTP when only Gmail credentials are present', () => {
    const m = load({ SMTP_USER: 'a@b.com', SMTP_PASS: 'x'.repeat(16) });
    expect(m.transportName()).toBe('smtp');
  });

  // SMTP is blocked on the deployment host, so an HTTPS API must win over it
  // whenever one is available.
  it('prefers an HTTPS API over SMTP', () => {
    const m = load({
      SMTP_USER: 'a@b.com', SMTP_PASS: 'x'.repeat(16), BREVO_API_KEY: 'k',
    });
    expect(m.transportName()).toBe('brevo');
  });

  it('falls back to resend when brevo is absent', () => {
    const m = load({ SMTP_USER: 'a@b.com', RESEND_API_KEY: 'k' });
    expect(m.transportName()).toBe('resend');
  });

  it('refuses to silently do nothing when unconfigured', async () => {
    const m = load({});
    await expect(m.sendMail({ to: 'x@y.com', subject: 's', html: '<p></p>' }))
      .rejects.toThrow(/No email transport configured/);
  });

  it('sends over HTTPS and does not touch SMTP when a key is set', async () => {
    const m = load({ SMTP_USER: 'a@b.com', BREVO_API_KEY: 'k' });
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, text: async () => '' };
    });

    await m.sendMail({ to: 'x@y.com', subject: 'Code', html: '<b>123456</b>' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('api.brevo.com');
    expect(calls[0].body.to[0].email).toBe('x@y.com');
    expect(calls[0].body.sender.email).toBe('a@b.com');
    delete global.fetch;
  });

  it('surfaces the provider error instead of reporting success', async () => {
    const m = load({ SMTP_USER: 'a@b.com', BREVO_API_KEY: 'k' });
    global.fetch = jest.fn(async () => ({
      ok: false, status: 401, text: async () => 'unauthorised',
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(m.sendMail({ to: 'x@y.com', subject: 's', html: '<p></p>' }))
      .rejects.toThrow(/401/);

    console.error.mockRestore();
    delete global.fetch;
  });
});
