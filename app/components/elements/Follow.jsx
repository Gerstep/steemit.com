import React, {PropTypes} from 'react';
import {connect} from 'react-redux';
import shouldComponentUpdate from 'app/utils/shouldComponentUpdate'
import transaction from 'app/redux/Transaction';
import g from 'app/redux/GlobalReducer';
import {Set, Map} from 'immutable'

const {string, object, bool, func} = PropTypes
const followTypes = ['blog', 'posts']
const followTypeSet = Set(followTypes)

export default class Follow extends React.Component {
    static propTypes = {
        follower: string, // default to current user
        following: string,
        what: string, // see followTypes
        showFollow: bool,
        showMute: bool,
        fat: bool,

        // redux
        follow: func,
        loading: bool,
        getFollowing: func,
        existingFollows: object,
    }
    static defaultProps = {
        showFollow: true,
        showMute: true,
        fat: false,
    }
    constructor(props) {
        super()
        this.initEvents(props)
        this.shouldComponentUpdate = shouldComponentUpdate(this, 'Follow')
    }
    componentWillMount() {
        getFollowers(this.props)
    }
    componentWillUpdate(nextProps) {
        getFollowers(nextProps)
        this.initEvents(nextProps)
    }
    initEvents(props) {
        const {follow, follower, following, existingFollows, what} = props
        this.follow = () => follow(follower, following, existingFollows.remove('ignore').add(what))
        this.unfollow = () => follow(follower, following, existingFollows.remove(what))
        this.ignore = () => follow(follower, following, Set(['ignore']))
        this.unignore = () => follow(follower, following, Set())
    }
    render() {
        const {follower, following, what, showFollow, showMute, fat} = this.props // html
        const {existingFollows, loading} = this.props // redux
        if(loading) return <span></span>
        if(!follower || !following || !what) return <span></span>
        if(follower === following) return <span></span> // don't follow self
        if(loading !== false) {
            // must know what the user is already following before any update can happen
            return <span></span>
        }
        if(!followTypeSet.has(what)) {
            console.log('Unknown follow type:', what)
            return <span></span>
        }
        const cnActive = 'button' + (fat ? '' : ' slim')
        const cnInactive = cnActive + ' hollow secondary'
        return <span>
            {showFollow && !existingFollows.has(what) && <label className={cnInactive} onClick={this.follow}>Follow</label>}
            {showFollow && existingFollows.has(what) && <label className={cnActive} onClick={this.unfollow}>Unfollow</label>}
            {showMute && !existingFollows.has('ignore') && <label className={cnInactive} onClick={this.ignore}>Mute</label>}
            {showMute && existingFollows.has('ignore') && <label className={cnActive} onClick={this.unignore}>Unmute</label>}
        </span>
    }
}
function getFollowers(props) {
    const {getFollowing, follower, loading} = props
    if(loading == null)
        getFollowing(follower)
}
const emptyMap = Map()
const emptySet = Set()
module.exports = connect(
    (state, ownProps) => {
        let {follower} = ownProps
        const {following} = ownProps
        if(!follower) {
            const current_user = state.user.get('current')
            follower = current_user ? current_user.get('username') : null
        }
        const f = state.global.getIn(['follow', 'get_following', follower], emptyMap)
        const loading = f.get('loading')
        const existingFollows = Set(f.getIn(['result', following], emptySet))// Convert List to Set
        return {
            follower,
            existingFollows,
            loading,
        };
    },
    dispatch => ({
        getFollowing: follower => {
            if(!follower) return
            const limit = 100 // Test with 2 (not 1, infinate looping)
            const fetch = (start = '') => {
                let cnt = 0
                dispatch({ type: 'global/FETCH_API', payload: {
                    exec: ['follow', 'get_following', follower, start, limit],
                    key: ['follow', 'get_following', follower],
                    skipLoading: true,
                    reducer: [
                        (r, value) => {
                            const what = value.get('what')
                            const following = value.get('following')
                            if(++cnt === limit) {
                                fetch(following)
                            }
                            return r.set(following, what)
                        },
                        Map()
                    ]
                }})
            }
            fetch()
        },
        follow: (follower, following, what) => {
            const json = {follower, following, what: what.toJS()}
            dispatch(g.actions.update({
                key: ['follow', 'get_following', follower, 'result', following],
                notSet: Set(),
                updater: () => what
            }))
            dispatch(transaction.actions.broadcastOperation({
                type: 'custom_json',
                operation: {
                    id: 'follow',
                    required_posting_auths: [follower],
                    json: JSON.stringify(json),
                },
            }))
        },
    })
)(Follow)
