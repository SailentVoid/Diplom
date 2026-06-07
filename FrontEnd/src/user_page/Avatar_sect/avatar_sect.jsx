import classes from './avatar_sect.module.scss'

function buildInitials(fullName) {
    const initials = (fullName ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')

    return initials || 'UI'
}

export default function Avatar_sect({ userData, profileFields }) {
    const initials = buildInitials(userData.fullName)
    const profileName = userData.fullName || 'Профиль пользователя'
    const profileEmail = userData.email || 'Не указан'

    return (
        <section className={classes.Avatar}>
            <div className={classes.Panel}>
                <div className={classes.Header}>
                    <h2>Текущие данные</h2>
                </div>

                <div className={classes.ProfileHero}>
                    <div className={classes.AvatarBadge}>{initials}</div>
                    <div className={classes.ProfileMeta}>
                        <h3>{profileName}</h3>
                        <p>{profileEmail}</p>
                    </div>
                </div>

                <div className={classes.FieldGrid}>
                    {profileFields.map((field) => (
                        <label key={field.key} className={classes.Field}>
                            <span>{field.label}</span>
                            <input
                                type="text"
                                value={userData[field.key] ?? ''}
                                readOnly
                                placeholder="Не заполнено"
                            />
                        </label>
                    ))}
                </div>
            </div>
        </section>
    )
}
