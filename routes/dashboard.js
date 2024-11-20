// In your dashboard route
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const universities = await User.distinct('university');
        res.render('dashboard', { 
            user: req.session.user,
            universities: universities,
            title: 'Dashboard'
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
}); 